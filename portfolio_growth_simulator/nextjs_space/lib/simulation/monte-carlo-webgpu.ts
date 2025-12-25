import { SimulationParams } from '@/lib/types'
import { calculatePercentile } from '@/lib/simulation/monte-carlo-engine'

function hashStringToU32(input: string): number {
  // FNV-1a 32-bit
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

function createUniformBufferData(args: {
  initialValue: number
  startingCostBasis: number
  postTaxReturn: number
  preTaxReturn: number
  sigma: number
  dt: number
  drift: number
  driftPreTax: number
  diffusion: number
  cashflowPerStep0: number
  inflationFactor: number
  taxRate: number
  portfolioGoal: number
  timeStepsPerYear: number
  totalTimeSteps: number
  recordFrequency: number
  numRecordedSteps: number
  taxEnabled: number
  taxType: number
  mode: number
  excludeInflationAdjustment: number
  seed: number
}): ArrayBuffer {
  // WGSL struct is 96 bytes (padded to 16)
  const buffer = new ArrayBuffer(96)
  const f32 = new Float32Array(buffer)
  const u32 = new Uint32Array(buffer)

  // f32 slots 0..12 (13 floats)
  f32[0] = args.initialValue
  f32[1] = args.startingCostBasis
  f32[2] = args.postTaxReturn
  f32[3] = args.preTaxReturn
  f32[4] = args.sigma
  f32[5] = args.dt
  f32[6] = args.drift
  f32[7] = args.driftPreTax
  f32[8] = args.diffusion
  f32[9] = args.cashflowPerStep0
  f32[10] = args.inflationFactor
  f32[11] = args.taxRate
  f32[12] = args.portfolioGoal

  // u32 slots start at byte offset 52 => index 13
  u32[13] = args.timeStepsPerYear >>> 0
  u32[14] = args.totalTimeSteps >>> 0
  u32[15] = args.recordFrequency >>> 0
  u32[16] = args.numRecordedSteps >>> 0
  u32[17] = args.taxEnabled >>> 0
  u32[18] = args.taxType >>> 0
  u32[19] = args.mode >>> 0
  u32[20] = args.excludeInflationAdjustment >>> 0
  u32[21] = args.seed >>> 0
  u32[22] = 0

  return buffer
}

const WGSL_SOURCE = `
struct Params {
  initialValue: f32,
  startingCostBasis: f32,
  postTaxReturn: f32,
  preTaxReturn: f32,
  sigma: f32,
  dt: f32,
  drift: f32,
  driftPreTax: f32,
  diffusion: f32,
  cashflowPerStep0: f32,
  inflationFactor: f32,
  taxRate: f32,
  portfolioGoal: f32,

  timeStepsPerYear: u32,
  totalTimeSteps: u32,
  recordFrequency: u32,
  numRecordedSteps: u32,
  taxEnabled: u32,
  taxType: u32,
  mode: u32,
  excludeInflationAdjustment: u32,
  seed: u32,
  _pad: u32,
};

@group(0) @binding(0) var<uniform> params: Params;

// Record buffers are laid out as [recordIndex][pathIndex], row-major.
@group(0) @binding(1) var<storage, read_write> netRecords: array<f32>;
@group(0) @binding(2) var<storage, read_write> grossRecords: array<f32>;

@group(0) @binding(3) var<storage, read_write> endingValues: array<f32>;
@group(0) @binding(4) var<storage, read_write> preTaxEndingValues: array<f32>;
@group(0) @binding(5) var<storage, read_write> lowestValues: array<f32>;
@group(0) @binding(6) var<storage, read_write> maxDrawdowns: array<f32>;
@group(0) @binding(7) var<storage, read_write> totalInvestedOut: array<f32>;
@group(0) @binding(8) var<storage, read_write> performanceRecords: array<f32>;

fn xorshift32(state: ptr<function, u32>) -> u32 {
  var x = (*state);
  x = x ^ (x << 13u);
  x = x ^ (x >> 17u);
  x = x ^ (x << 5u);
  (*state) = x;
  return x;
}

fn rng_f32(state: ptr<function, u32>) -> f32 {
  // (0,1], avoid 0 exactly.
  let x = xorshift32(state);
  return (f32(x) + 1.0) * (1.0 / 4294967296.0);
}

fn normal_rand(state: ptr<function, u32>) -> f32 {
  let u1 = max(rng_f32(state), 1e-7);
  let u2 = rng_f32(state);
  let r = sqrt(-2.0 * log(u1));
  let theta = 6.283185307179586 * u2;
  return r * cos(theta);
}

fn net_liquidation(balance: f32, basis: f32) -> f32 {
  if (params.taxEnabled == 0u) {
    return balance;
  }
  // taxType: 0=capital_gains, 1=income, 2=tax_deferred
  if (params.taxType == 2u) {
    return balance * (1.0 - params.taxRate);
  }
  if (params.taxType == 0u) {
    let profit = balance - basis;
    if (profit > 0.0) {
      return balance - (profit * params.taxRate);
    }
    return balance;
  }
  return balance;
}

@compute @workgroup_size(128)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let path = gid.x;
  let numPaths = arrayLength(&endingValues);
  if (path >= numPaths) {
    return;
  }

  var rngState: u32 = params.seed ^ (path * 747796405u + 2891336453u);

  var currentValue: f32 = params.initialValue;
  var preTaxValue: f32 = params.initialValue;
  var currentCashflow: f32 = params.cashflowPerStep0;
  var totalInvested: f32 = params.startingCostBasis;
  var totalBasis: f32 = params.startingCostBasis;

  var performanceValue: f32 = 1.0;

  var peak: f32 = net_liquidation(currentValue, totalBasis);
  var lowest: f32 = params.initialValue;
  var maxDD: f32 = 0.0;

  // record step 0
  netRecords[path] = peak;
  grossRecords[path] = currentValue;
  performanceRecords[path] = 1.0;

  for (var step: u32 = 1u; step <= params.totalTimeSteps; step = step + 1u) {
    let z = normal_rand(&rngState);
    let growthFactor = exp(params.drift + params.diffusion * z);
    let isIncomeTax = (params.taxEnabled == 1u && params.taxType == 1u);
    let growthFactorPreTax = select(0.0, exp(params.driftPreTax + params.diffusion * z), isIncomeTax);

    // Track pure asset performance (independent of cashflows)
    performanceValue = performanceValue * growthFactor;

    if (params.mode == 1u) {
      // withdrawal
      var stepWithdrawal: f32 = currentCashflow;

      if (params.taxEnabled == 1u && params.taxType != 1u) {
        if (params.taxType == 2u) {
          stepWithdrawal = currentCashflow;
        } else {
          let gainFraction = select(0.0, (currentValue - totalBasis) / currentValue, currentValue > totalBasis && currentValue > 0.0);
          var effectiveTaxRate = params.taxRate * gainFraction;
          effectiveTaxRate = min(effectiveTaxRate, 0.99);
          stepWithdrawal = currentCashflow;
        }
      }

      if (stepWithdrawal > currentValue) {
        stepWithdrawal = currentValue;
      }

      if (params.taxType != 2u) {
        if (currentValue > 0.0) {
          totalBasis = totalBasis * (1.0 - (stepWithdrawal / currentValue));
        }
      }

      currentValue = max(0.0, currentValue - stepWithdrawal);
      currentValue = currentValue * growthFactor;

      if (isIncomeTax) {
        var preTaxWithdrawal: f32 = stepWithdrawal;
        if (preTaxWithdrawal > preTaxValue) {
          preTaxWithdrawal = preTaxValue;
        }
        preTaxValue = max(0.0, preTaxValue - preTaxWithdrawal);
        preTaxValue = preTaxValue * growthFactorPreTax;
      }
    } else {
      // growth
      currentValue = currentValue * growthFactor;
      currentValue = currentValue + currentCashflow;
      totalInvested = totalInvested + currentCashflow;

      if (isIncomeTax) {
        preTaxValue = preTaxValue * growthFactorPreTax;
        preTaxValue = preTaxValue + currentCashflow;
      }
    }

    let basisForNet = select(totalBasis, totalInvested, params.mode == 0u);
    let netValue = net_liquidation(currentValue, basisForNet);

    if (netValue < lowest) {
      lowest = netValue;
    }
    if (netValue > peak) {
      peak = netValue;
    }
    if (peak > 0.0) {
      let dd = (peak - netValue) / peak;
      if (dd > maxDD) {
        maxDD = dd;
      }
    }

    if (params.recordFrequency > 0u && (step % params.recordFrequency) == 0u) {
      let recordIndex = step / params.recordFrequency;
      let outIndex = recordIndex * numPaths + path;
      netRecords[outIndex] = netValue;
      grossRecords[outIndex] = currentValue;
      performanceRecords[outIndex] = performanceValue;
    }

    if (params.excludeInflationAdjustment == 0u && (step % params.timeStepsPerYear) == 0u) {
      currentCashflow = currentCashflow * params.inflationFactor;
    }
  }

  var finalEffective: f32 = currentValue;
  var finalPreTax: f32 = select(currentValue, preTaxValue, (params.taxEnabled == 1u && params.taxType == 1u));

  if (params.mode == 0u && params.taxEnabled == 1u) {
    if (params.taxType == 0u) {
      let profit = currentValue - totalInvested;
      if (profit > 0.0) {
        finalEffective = currentValue - (profit * params.taxRate);
      }
    } else if (params.taxType == 2u) {
      finalEffective = currentValue * (1.0 - params.taxRate);
    }
  }

  endingValues[path] = finalEffective;
  preTaxEndingValues[path] = finalPreTax;
  lowestValues[path] = lowest;
  maxDrawdowns[path] = maxDD;
  totalInvestedOut[path] = totalInvested;
}
`

async function readBuffer(device: any, buffer: any, byteLength: number): Promise<ArrayBuffer> {
  const readback = device.createBuffer({
    size: byteLength,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  })
  const encoder = device.createCommandEncoder()
  encoder.copyBufferToBuffer(buffer, 0, readback, 0, byteLength)
  device.queue.submit([encoder.finish()])
  await device.queue.onSubmittedWorkDone()
  await readback.mapAsync(GPUMapMode.READ)
  const copy = readback.getMappedRange().slice(0)
  readback.unmap()
  readback.destroy()
  return copy
}

export async function performMonteCarloSimulationWebGPU(
  params: SimulationParams,
  mode: 'growth' | 'withdrawal',
  seed?: string
) {
  if (typeof navigator === 'undefined' || !(navigator as any).gpu) {
    throw new Error('WebGPU not available')
  }

  const adapter = await (navigator as any).gpu.requestAdapter()
  if (!adapter) throw new Error('WebGPU adapter not available')

  const device = await adapter.requestDevice()

  const {
    initialValue,
    startingCostBasis,
    expectedReturn,
    volatility,
    duration,
    cashflowAmount,
    cashflowFrequency = 'monthly',
    inflationAdjustment = 0,
    excludeInflationAdjustment = false,
    numPaths = 10000,
    portfolioGoal = 0,
    taxEnabled = false,
    taxRate = 0,
    taxType = 'capital_gains',
    calculationMode = 'effective'
  } = params

  const getStepsPerYear = (f: SimulationParams['cashflowFrequency']) => {
    if (f === 'weekly') return 52
    if (f === 'monthly') return 12
    if (f === 'quarterly') return 4
    return 1
  }

  const timeStepsPerYear = getStepsPerYear(cashflowFrequency)

  const maxStorageBindingBytes = Number((device as any)?.limits?.maxStorageBufferBindingSize ?? 0)
  const maxBufferBytes = Number((device as any)?.limits?.maxBufferSize ?? 0)
  const maxRecordsBufferBytes = Math.min(
    maxStorageBindingBytes > 0 ? maxStorageBindingBytes : Number.POSITIVE_INFINITY,
    maxBufferBytes > 0 ? maxBufferBytes : Number.POSITIVE_INFINITY
  )

  const maxPointsPerRecordsBuffer = maxRecordsBufferBytes === Number.POSITIVE_INFINITY
    ? 10_000_000
    : Math.max(0, Math.floor(maxRecordsBufferBytes / 4))

  const MAX_TOTAL_DATA_POINTS = Math.max(
    0,
    Math.min(
      10_000_000,
      Math.max(0, maxPointsPerRecordsBuffer - Math.max(0, numPaths))
    )
  )
  const MAX_CHART_STEPS = 500
  const totalSimulationSteps = Math.floor(duration * timeStepsPerYear)
  const memoryAllowedSteps = Math.floor(MAX_TOTAL_DATA_POINTS / numPaths)
  const deviceAllowedSteps = Math.max(0, Math.floor(maxPointsPerRecordsBuffer / numPaths) - 1)
  const targetSteps = Math.min(memoryAllowedSteps, MAX_CHART_STEPS, deviceAllowedSteps)
  let recordFrequency = totalSimulationSteps + 1
  if (targetSteps >= 1) {
    recordFrequency = Math.ceil(totalSimulationSteps / Math.max(1, targetSteps))
    if (recordFrequency < 1) recordFrequency = 1
  }

  const dt = 1 / timeStepsPerYear
  const totalTimeSteps = totalSimulationSteps

  const clampedStartingCostBasis = Math.max(0, Math.min(startingCostBasis ?? initialValue, initialValue))

  const isIncomeTax = taxEnabled && taxType === 'income'

  let preTaxReturn = expectedReturn
  let postTaxReturn = expectedReturn

  if (isIncomeTax) {
    postTaxReturn = expectedReturn * (1 - taxRate / 100)
  }

  if (calculationMode === 'nominal') {
    preTaxReturn = (Math.pow(1 + preTaxReturn / 100 / timeStepsPerYear, timeStepsPerYear) - 1) * 100
    postTaxReturn = (Math.pow(1 + postTaxReturn / 100 / timeStepsPerYear, timeStepsPerYear) - 1) * 100
  }

  const r = postTaxReturn / 100
  const rPreTax = preTaxReturn / 100
  const sigma = volatility / 100
  const mu = Math.log(1 + r)
  const muPreTax = Math.log(1 + rPreTax)
  const drift = mu * dt
  const driftPreTax = muPreTax * dt
  const diffusion = sigma * Math.sqrt(dt)

  let cashflowPerStep = cashflowAmount
  const inflationFactor = 1 + inflationAdjustment / 100

  const numRecordedSteps = Math.floor(totalTimeSteps / recordFrequency)

  const deterministicSeries: { year: number, value: number }[] = []
  const deterministicSeriesGross: { year: number, value: number }[] = []
  const deterministicYearData: Array<{
    year: number
    startingBalance: number
    withdrawals: number
    netIncome: number
    taxPaid: number
    endingBalance: number
    isSustainable: boolean
  }> = []

  function getNetLiquidationValue(balance: number, basis: number): number {
    if (!taxEnabled) return balance
    if (taxType === 'tax_deferred') {
      return balance * (1 - (taxRate / 100))
    }
    if (taxType === 'capital_gains') {
      const profitForTax = balance - basis
      if (profitForTax > 0) {
        return balance - (profitForTax * (taxRate / 100))
      }
      return balance
    }
    return balance
  }

  // --- DETERMINISTIC PATH CALCULATION (kept on CPU) ---
  let detValue = initialValue
  let detBasis = clampedStartingCostBasis
  let detCashflow = cashflowPerStep
  const detStepRate = Math.pow(1 + r, dt) - 1

  let detYearStartBalance = initialValue
  let detYearWithdrawals = 0
  let detYearNetIncome = 0
  let detYearTaxPaid = 0

  deterministicSeries.push({ year: 0, value: getNetLiquidationValue(initialValue, detBasis) })
  deterministicSeriesGross.push({ year: 0, value: initialValue })

  for (let step = 1; step <= totalTimeSteps; step++) {
    let stepTaxPaid = 0
    let stepWithdrawal = 0
    let stepNet = 0

    if (mode === 'withdrawal') {
      stepWithdrawal = detCashflow
      stepNet = detCashflow

      if (taxEnabled && taxType !== 'income') {
        if (taxType === 'tax_deferred') {
          stepWithdrawal = detCashflow
          stepTaxPaid = detCashflow * (taxRate / 100)
          stepNet = stepWithdrawal - stepTaxPaid
        } else {
          const gainFraction = detValue > detBasis ? (detValue - detBasis) / detValue : 0
          let effectiveTaxRate = (taxRate / 100) * gainFraction
          if (effectiveTaxRate >= 0.99) effectiveTaxRate = 0.99
          stepWithdrawal = detCashflow
          stepTaxPaid = stepWithdrawal * effectiveTaxRate
          stepNet = stepWithdrawal - stepTaxPaid
        }
      }

      if (stepWithdrawal > detValue) {
        const ratio = detValue / (stepWithdrawal || 1)
        stepWithdrawal = detValue
        stepNet = stepNet * ratio
        stepTaxPaid = stepTaxPaid * ratio
      }

      if (taxType !== 'tax_deferred') {
        if (detValue > 0) {
          detBasis = detBasis * (1 - (stepWithdrawal / detValue))
        }
      }

      detValue -= stepWithdrawal
      detValue = Math.max(0, detValue)

      detYearWithdrawals += stepWithdrawal
      detYearNetIncome += stepNet
      detYearTaxPaid += stepTaxPaid
    }

    const valueBeforeGrowth = detValue
    detValue = detValue * (1 + detStepRate)

    if (taxEnabled && taxType === 'income') {
      const growth = detValue - valueBeforeGrowth
      let t = taxRate / 100
      if (t >= 0.99) t = 0.99
      const drag = growth * (t / (1 - t))
      detValue -= drag
      detValue = Math.max(0, detValue)
      detYearTaxPaid += drag
    }

    if (mode === 'growth') {
      detValue += detCashflow
      detBasis += detCashflow
    }

    if (step % recordFrequency === 0) {
      const yearValue = step / timeStepsPerYear
      deterministicSeries.push({ year: yearValue, value: getNetLiquidationValue(detValue, mode === 'growth' ? detBasis : detBasis) })
      deterministicSeriesGross.push({ year: yearValue, value: detValue })
    }

    if (step % timeStepsPerYear === 0) {
      if (mode === 'withdrawal') {
        deterministicYearData.push({
          year: step / timeStepsPerYear,
          startingBalance: detYearStartBalance,
          withdrawals: detYearWithdrawals,
          netIncome: detYearNetIncome,
          taxPaid: detYearTaxPaid,
          endingBalance: getNetLiquidationValue(detValue, detBasis),
          isSustainable: detValue > 0
        })
        detYearStartBalance = getNetLiquidationValue(detValue, detBasis)
        detYearWithdrawals = 0
        detYearNetIncome = 0
        detYearTaxPaid = 0
      }

      if (!excludeInflationAdjustment) {
        detCashflow *= inflationFactor
      }
    }
  }
  // --- END DETERMINISTIC ---

  // --- WEBGPU STOCHASTIC SIMULATION ---

  const taxTypeCode =
    taxType === 'income' ? 1 : (taxType === 'tax_deferred' ? 2 : 0)

  const seedStr = seed ?? `monte-carlo-${Date.now()}-${Math.random()}`
  const seedU32 = hashStringToU32(seedStr)

  const uniformData = createUniformBufferData({
    initialValue,
    startingCostBasis: clampedStartingCostBasis,
    postTaxReturn: r,
    preTaxReturn: rPreTax,
    sigma,
    dt,
    drift,
    driftPreTax,
    diffusion,
    cashflowPerStep0: cashflowPerStep,
    inflationFactor,
    taxRate: (taxRate / 100),
    portfolioGoal: portfolioGoal ?? 0,
    timeStepsPerYear,
    totalTimeSteps,
    recordFrequency,
    numRecordedSteps,
    taxEnabled: taxEnabled ? 1 : 0,
    taxType: taxTypeCode,
    mode: mode === 'withdrawal' ? 1 : 0,
    excludeInflationAdjustment: excludeInflationAdjustment ? 1 : 0,
    seed: seedU32
  })

  const uniformBuffer = device.createBuffer({
    size: 96,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  })
  device.queue.writeBuffer(uniformBuffer, 0, uniformData)

  const recordsLength = (numRecordedSteps + 1) * numPaths
  const recordsByteLength = recordsLength * 4

  const netRecordsBuffer = device.createBuffer({
    size: recordsByteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
  })
  const grossRecordsBuffer = device.createBuffer({
    size: recordsByteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
  })
  // NEW: Buffer for Pure Asset Performance tracking
  const performanceRecordsBuffer = device.createBuffer({
    size: recordsByteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
  })

  const endingValuesBuffer = device.createBuffer({
    size: numPaths * 4,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
  })
  const preTaxEndingValuesBuffer = device.createBuffer({
    size: numPaths * 4,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
  })
  const lowestValuesBuffer = device.createBuffer({
    size: numPaths * 4,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
  })
  const maxDrawdownsBuffer = device.createBuffer({
    size: numPaths * 4,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
  })
  const investedBuffer = device.createBuffer({
    size: numPaths * 4,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
  })

  const shaderModule = device.createShaderModule({
    code: WGSL_SOURCE
  })

  const pipeline = device.createComputePipeline({
    layout: 'auto',
    compute: {
      module: shaderModule,
      entryPoint: 'main',
    },
  })

  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: uniformBuffer } },
      { binding: 1, resource: { buffer: netRecordsBuffer } },
      { binding: 2, resource: { buffer: grossRecordsBuffer } },
      { binding: 3, resource: { buffer: endingValuesBuffer } },
      { binding: 4, resource: { buffer: preTaxEndingValuesBuffer } },
      { binding: 5, resource: { buffer: lowestValuesBuffer } },
      { binding: 6, resource: { buffer: maxDrawdownsBuffer } },
      { binding: 7, resource: { buffer: investedBuffer } },
      { binding: 8, resource: { buffer: performanceRecordsBuffer } },
    ]
  })

  const encoder = device.createCommandEncoder()
  const pass = encoder.beginComputePass()
  pass.setPipeline(pipeline)
  pass.setBindGroup(0, bindGroup)
  const workgroupSize = 128
  const dispatchX = Math.ceil(numPaths / workgroupSize)
  pass.dispatchWorkgroups(dispatchX)
  pass.end()
  device.queue.submit([encoder.finish()])
  await device.queue.onSubmittedWorkDone()

  // -----------------------------------------------------------------------
  // SEQUENTIAL READ & PROCESSING to save memory on mobile devices
  // -----------------------------------------------------------------------

  // 1. Read small summary buffers first
  const endingValuesData = new Float32Array(await readBuffer(device, endingValuesBuffer, numPaths * 4))
  const preTaxEndingValuesData = new Float32Array(await readBuffer(device, preTaxEndingValuesBuffer, numPaths * 4))
  const lowestValuesData = new Float32Array(await readBuffer(device, lowestValuesBuffer, numPaths * 4))
  const maxDrawdownsData = new Float32Array(await readBuffer(device, maxDrawdownsBuffer, numPaths * 4))
  const investedData = new Float32Array(await readBuffer(device, investedBuffer, numPaths * 4))

  // Cleanup summary buffers
  endingValuesBuffer.destroy()
  preTaxEndingValuesBuffer.destroy()
  lowestValuesBuffer.destroy()
  maxDrawdownsBuffer.destroy()
  investedBuffer.destroy()
  uniformBuffer.destroy()

  // Prepare standard JS arrays for summary stats
  const endingValues: number[] = Array.from(endingValuesData)
  const preTaxEndingValues: number[] = Array.from(preTaxEndingValuesData)
  const lowestValues: number[] = Array.from(lowestValuesData)
  const maxDrawdowns: number[] = Array.from(maxDrawdownsData)
  const totalInvestedOut: number[] = Array.from(investedData)

  // 2. Read NET RECORDS -> Process Chart & Solvency -> Discard
  // CHANGED: 'let' instead of 'const' so we can nullify it
  let netRecordsData: Float32Array | null = new Float32Array(await readBuffer(device, netRecordsBuffer, recordsByteLength))
  netRecordsBuffer.destroy()

  const solvencySeries: { year: number, solventRate: number }[] = []
  const chartData = []

  for (let i = 0; i <= numRecordedSteps; i++) {
    const start = i * numPaths
    const end = start + numPaths
    const stepNumber = i * recordFrequency
    const yearValue = stepNumber / timeStepsPerYear
    
    // Create subarray view (no copy)
    // Note: TypeScript might complain if netRecordsData is possibly null inside loop,
    // but logic flow ensures it isn't null here.
    const stepValues = netRecordsData!.subarray(start, end)

    // Solvency
    let solventCount = 0
    for(let k = 0; k < stepValues.length; k++) {
      if(stepValues[k] > 0.01) solventCount++
    }
    solvencySeries.push({
      year: yearValue,
      solventRate: (solventCount / numPaths) * 100
    })

    // Chart Data (requires sorting, so we slice to copy)
    const sortedPeriodValues = netRecordsData!.slice(start, end).sort() as unknown as number[]
    chartData.push({
      year: yearValue,
      p10: calculatePercentile(sortedPeriodValues, 0.1),
      p25: calculatePercentile(sortedPeriodValues, 0.25),
      p50: calculatePercentile(sortedPeriodValues, 0.5),
      p75: calculatePercentile(sortedPeriodValues, 0.75),
      p90: calculatePercentile(sortedPeriodValues, 0.9),
    })
  }
  
  // Explicitly release net records reference (GC hint)
  // @ts-ignore
  netRecordsData = null 

  // 3. Read GROSS RECORDS -> Process Chart -> Discard
  // CHANGED: 'let' instead of 'const'
  let grossRecordsData: Float32Array | null = new Float32Array(await readBuffer(device, grossRecordsBuffer, recordsByteLength))
  grossRecordsBuffer.destroy()

  const chartDataGross = []
  for (let i = 0; i <= numRecordedSteps; i++) {
    const start = i * numPaths
    const end = start + numPaths
    const stepNumber = i * recordFrequency
    const yearValue = stepNumber / timeStepsPerYear
    
    const sortedPeriodValues = grossRecordsData!.slice(start, end).sort() as unknown as number[]
    chartDataGross.push({
      year: yearValue,
      p10: calculatePercentile(sortedPeriodValues, 0.1),
      p25: calculatePercentile(sortedPeriodValues, 0.25),
      p50: calculatePercentile(sortedPeriodValues, 0.5),
      p75: calculatePercentile(sortedPeriodValues, 0.75),
      p90: calculatePercentile(sortedPeriodValues, 0.9),
    })
  }
  // @ts-ignore
  grossRecordsData = null

  // 4. Read PERFORMANCE RECORDS -> Process Annual Returns -> Discard
  // CHANGED: 'let' instead of 'const'
  let performanceRecordsData: Float32Array | null = new Float32Array(await readBuffer(device, performanceRecordsBuffer, recordsByteLength))
  performanceRecordsBuffer.destroy()

  const annualReturnsData: any[] = []
  // Reuse a single temporary buffer for calculations to save allocation overhead
  // CHANGED: 'let' instead of 'const'
  let tempCagrBuffer: Float32Array | null = new Float32Array(numPaths)

  for (let i = 1; i <= numRecordedSteps; i++) {
    const currentStepNumber = i * recordFrequency
    const yearValue = currentStepNumber / timeStepsPerYear
    const start = i * numPaths
    const end = start + numPaths
    const values = performanceRecordsData!.subarray(start, end)
    
    // Fill temp buffer
    if (yearValue <= 0) {
       for(let k=0; k<numPaths; k++) tempCagrBuffer![k] = 0;
    } else {
       for(let k=0; k<numPaths; k++) {
          tempCagrBuffer![k] = (Math.pow(values[k], 1 / yearValue) - 1) * 100
       }
    }
    
    // Sort temp buffer in place
    tempCagrBuffer!.sort()
    
    const countAbove = (threshold: number) => {
        // Binary search could be faster but simple loop on sorted array is linear and fine for JS
        let count = 0
        for(let k = 0; k < numPaths; k++) {
            if(tempCagrBuffer![k] >= threshold) count++
        }
        return (count / numPaths) * 100
    }

    const sortedCagrs = tempCagrBuffer as unknown as number[]

    annualReturnsData.push({
      year: yearValue,
      p10: calculatePercentile(sortedCagrs, 0.1),
      p25: calculatePercentile(sortedCagrs, 0.25),
      median: calculatePercentile(sortedCagrs, 0.5),
      p75: calculatePercentile(sortedCagrs, 0.75),
      p90: calculatePercentile(sortedCagrs, 0.9),
      prob5: countAbove(5),
      prob8: countAbove(8),
      prob10: countAbove(10),
      prob12: countAbove(12),
      prob15: countAbove(15),
      prob20: countAbove(20),
      prob25: countAbove(25),
      prob30: countAbove(30)
    })
  }
  // @ts-ignore
  performanceRecordsData = null
  // @ts-ignore
  tempCagrBuffer = null

  // -----------------------------------------------------------------------
  // END SEQUENTIAL PROCESSING
  // -----------------------------------------------------------------------

  let pathsReachingGoal = 0
  let pathsProfitable = 0
  let pathsSolvent = 0

  for (let i = 0; i < numPaths; i++) {
    const finalValueEffective = endingValues[i]
    const invested = totalInvestedOut[i]
    if (portfolioGoal && finalValueEffective >= portfolioGoal) pathsReachingGoal++
    if (finalValueEffective > invested) pathsProfitable++
    if (finalValueEffective > 0) pathsSolvent++
  }

  const sortedEndingValues = [...endingValues].sort((a, b) => a - b)
  const sortedPreTaxEndingValues = [...preTaxEndingValues].sort((a, b) => a - b)

  // Loss probabilities
  const lossThresholds = [0, 2.5, 5, 10, 15, 20, 30, 50]
  const lossProbData: {
    threshold: string
    endPeriod: number
    intraPeriod: number
  }[] = lossThresholds.map((threshold) => {
    const countEnd = endingValues.filter((val) => {
      if (val >= initialValue) return false
      const lossPct = ((initialValue - val) / initialValue) * 100
      return lossPct >= threshold
    }).length

    const countIntra = lowestValues.filter((val) => {
      const lossPct = ((initialValue - val) / initialValue) * 100
      return lossPct >= threshold
    }).length

    return {
      threshold: `>= ${threshold}%`,
      endPeriod: (countEnd / numPaths) * 100,
      intraPeriod: (countIntra / numPaths) * 100,
    }
  })

  // Tax Drag Calc
  const mean = endingValues.reduce((sum, val) => sum + val, 0) / numPaths
  const meanPreTax = preTaxEndingValues.reduce((sum, val) => sum + val, 0) / numPaths
  let taxDragAmount = 0

  if (taxEnabled && mode === 'growth') {
    taxDragAmount = meanPreTax - mean
  }

  const median = calculatePercentile(sortedEndingValues, 0.5)
  const medianGross = calculatePercentile(sortedPreTaxEndingValues, 0.5)
  const p5 = calculatePercentile(sortedEndingValues, 0.05)
  const p10 = calculatePercentile(sortedEndingValues, 0.1)
  const p25 = calculatePercentile(sortedEndingValues, 0.25)
  const p75 = calculatePercentile(sortedEndingValues, 0.75)
  const p90 = calculatePercentile(sortedEndingValues, 0.9)
  const p95 = calculatePercentile(sortedEndingValues, 0.95)
  const p5Gross = calculatePercentile(sortedPreTaxEndingValues, 0.05)
  const p10Gross = calculatePercentile(sortedPreTaxEndingValues, 0.1)
  const p25Gross = calculatePercentile(sortedPreTaxEndingValues, 0.25)
  const p75Gross = calculatePercentile(sortedPreTaxEndingValues, 0.75)
  const p90Gross = calculatePercentile(sortedPreTaxEndingValues, 0.9)
  const p95Gross = calculatePercentile(sortedPreTaxEndingValues, 0.95)
  const best = sortedEndingValues[sortedEndingValues.length - 1] ?? 0
  const worst = sortedEndingValues[0] ?? 0
  const bestGross = sortedPreTaxEndingValues[sortedPreTaxEndingValues.length - 1] ?? 0
  const worstGross = sortedPreTaxEndingValues[0] ?? 0

  const spreadRatio = p95 > 0 && p5 > 0 ? p95 / p5 : 0
  const totalRatio = best > 0 && worst > 0 ? best / worst : 0
  const recommendLogHistogram = spreadRatio > 15 || totalRatio > 50
  const growthRatio = p90 > 0 && initialValue > 0 ? p90 / initialValue : 0
  const recommendLogLinear = growthRatio > 20
  const sortedMaxDrawdowns = [...maxDrawdowns].sort((a, b) => a - b)
  const medianDrawdown = calculatePercentile(sortedMaxDrawdowns, 0.5)
  const worstDrawdown = Math.max(...maxDrawdowns)
  const recommendLogDrawdown = medianDrawdown < 0.1 && worstDrawdown > 0.6

  const goalProbability = portfolioGoal ? (pathsReachingGoal / numPaths) * 100 : 0
  const profitableRate = (pathsProfitable / numPaths) * 100
  const solventRate = (pathsSolvent / numPaths) * 100

  // Investment data (discrete schedule)
  const investmentData: {
    year: number
    initial: number
    contributions: number
    total: number
  }[] = []

  let simInvInitial = initialValue
  let simInvContrib = 0
  let simChartCashflow = mode === 'growth' ? cashflowPerStep : 0

  investmentData.push({
    year: 0,
    initial: simInvInitial,
    contributions: 0,
    total: simInvInitial
  })

  for (let step = 1; step <= totalTimeSteps; step++) {
    if (mode === 'growth') {
      simInvContrib += simChartCashflow
    }
    if (step % recordFrequency === 0) {
      const yearValue = step / timeStepsPerYear
      investmentData.push({
        year: yearValue,
        initial: simInvInitial,
        contributions: simInvContrib,
        total: simInvInitial + simInvContrib
      })
    }
    if (step % timeStepsPerYear === 0) {
      simChartCashflow *= inflationFactor
    }
  }

  return {
    endingValues,
    endingValuesGross: preTaxEndingValues,
    maxDrawdowns,
    annualReturnsData,
    lossProbData,
    investmentData,
    chartData,
    chartDataGross,
    solvencySeries,
    deterministicSeries,
    deterministicSeriesGross,
    deterministicYearData,
    taxDragAmount,
    totalTaxWithheld: 0,
    totalTaxDrag: taxDragAmount,
    totalTaxCost: taxDragAmount,
    mean,
    meanGross: meanPreTax,
    median,
    medianGross,
    p5,
    p5Gross,
    p10,
    p10Gross,
    p25,
    p25Gross,
    p75,
    p75Gross,
    p90,
    p90Gross,
    p95,
    p95Gross,
    best,
    bestGross,
    worst,
    worstGross,
    goalProbability,
    pathsReachingGoal,
    profitableRate,
    solventRate,
    numPathsUsed: numPaths,
    recommendLogLinear,
    recommendLogHistogram,
    recommendLogDrawdown,
    portfolioGoalSnapshot: portfolioGoal,
  }
}