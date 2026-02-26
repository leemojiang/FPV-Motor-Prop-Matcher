/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  AreaChart,
} from 'recharts';
import { 
  Zap, 
  Wind, 
  Settings2, 
  Activity, 
  TrendingUp, 
  Info,
  ChevronRight,
  Gauge
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Constants & Types ---

interface MotorParams {
  kv: number;       // RPM/V
  resistance: number; // Ohms
  noLoadCurrent: number; // Amps
}

interface PropParams {
  diameter: number; // inches
  pitch: number;    // inches
  ct: number;       // Thrust coefficient
  cp: number;       // Power coefficient
}

interface EnvironmentParams {
  voltage: number;  // Volts
  airDensity: number; // kg/m^3
  flightVelocity: number; // m/s
}

const PRESETS = {
  freestyle6s: {
    name: "5\" Freestyle (6S)",
    motor: { kv: 1750, resistance: 0.045, noLoadCurrent: 1.2 },
    prop: { diameter: 5.1, pitch: 4.3, ct: 0.11, cp: 0.05 },
    env: { voltage: 22.2, airDensity: 1.225, flightVelocity: 0 }
  },
  racing4s: {
    name: "5\" Racing (4S)",
    motor: { kv: 2450, resistance: 0.035, noLoadCurrent: 1.8 },
    prop: { diameter: 5.0, pitch: 4.5, ct: 0.12, cp: 0.06 },
    env: { voltage: 14.8, airDensity: 1.225, flightVelocity: 0 }
  },
  longRange7: {
    name: "7\" Long Range (6S)",
    motor: { kv: 1300, resistance: 0.06, noLoadCurrent: 0.8 },
    prop: { diameter: 7.0, pitch: 4.0, ct: 0.10, cp: 0.045 },
    env: { voltage: 22.2, airDensity: 1.225, flightVelocity: 0 }
  },
  sub250g: {
    name: "4\" Sub-250g (4S)",
    motor: { kv: 3800, resistance: 0.08, noLoadCurrent: 0.6 },
    prop: { diameter: 4.0, pitch: 3.0, ct: 0.09, cp: 0.04 },
    env: { voltage: 14.8, airDensity: 1.225, flightVelocity: 0 }
  }
};

// --- Helper Functions ---

const rpmToRadS = (rpm: number) => (rpm * 2 * Math.PI) / 60;
const radSToRpm = (rads: number) => (rads * 60) / (2 * Math.PI);
const inchToMeter = (inch: number) => inch * 0.0254;

export default function App() {
  const [motor, setMotor] = useState<MotorParams>(PRESETS.freestyle6s.motor);
  const [prop, setProp] = useState<PropParams>(PRESETS.freestyle6s.prop);
  const [env, setEnv] = useState<EnvironmentParams>(PRESETS.freestyle6s.env);
  const [activeTab, setActiveTab] = useState<'torque' | 'thrust' | 'efficiency' | 'power' | 'voltage_response'>('torque');

  // --- Calculations ---

  const results = useMemo(() => {
    const kv_rad = rpmToRadS(motor.kv); // rad/s/V
    const R = motor.resistance;
    const io = motor.noLoadCurrent;
    const v = env.voltage;
    const rho = env.airDensity;
    const propRadius = inchToMeter(prop.diameter) / 2;
    const V = env.flightVelocity;

    // Effective coefficients (Pitch scaled)
    const pitchRatio = prop.pitch / prop.diameter;
    const eff_ct = prop.ct * pitchRatio;
    const eff_cp = prop.cp * pitchRatio;

    // Propeller constant k where Torque = k * omega^2
    // Q = 0.5 * rho * (omega * R)^2 * pi * R^3 * Cp = (0.5 * rho * pi * R^5 * Cp) * omega^2
    const k_prop = 0.5 * rho * Math.PI * Math.pow(propRadius, 5) * eff_cp;
    const k_thrust = 0.5 * rho * Math.PI * Math.pow(propRadius, 4) * eff_ct;

    const data = [];
    const voltageData = [];
    const maxRpm = Math.max(1000, motor.kv * v);
    const steps = 200;
    const step = maxRpm / steps;

    // 1. RPM Sweep for current voltage
    for (let rpm = 0; rpm <= maxRpm; rpm += step) {
      const omega = rpmToRadS(rpm);
      const current = Math.max(0, (v - omega / kv_rad) / R);
      const motorTorque = Math.max(0, (current - io) / kv_rad);
      const pShaftMotor = motorTorque * omega;
      const pElec = v * current;
      const motorEff = pElec > 0 ? (pShaftMotor / pElec) * 100 : 0;

      const thrust = k_thrust * Math.pow(omega, 2);
      const propTorque = k_prop * Math.pow(omega, 2);
      const propPower = propTorque * omega;

      data.push({
        rpm: Math.round(rpm),
        motorTorque: Number(motorTorque.toFixed(4)),
        propTorque: Number(propTorque.toFixed(4)),
        thrust: Number((thrust * 101.97).toFixed(1)),
        efficiency: Number(Math.max(0, motorEff).toFixed(1)),
        current: Number(current.toFixed(1)),
        pElec: Number(pElec.toFixed(1)),
        pShaftMotor: Number(pShaftMotor.toFixed(1)),
        pProp: Number(propPower.toFixed(1)),
      });
    }

    // 2. Analytical Equilibrium Solver (Used for chart sweeping)
    const solveEquilibrium = (volts: number) => {
      const a = k_prop;
      const b = 1 / (R * Math.pow(kv_rad, 2));
      const c = (io / kv_rad) - (volts / (R * kv_rad));
      const discriminant = Math.pow(b, 2) - 4 * a * c;
      if (discriminant < 0) return null;
      const omega = (-b + Math.sqrt(discriminant)) / (2 * a);
      if (omega < 0) return null;
      const rpm = (omega * 60) / (2 * Math.PI);
      const current = Math.max(0, (volts - omega / kv_rad) / R);
      const thrust = k_thrust * Math.pow(omega, 2);
      const torque = k_prop * Math.pow(omega, 2);
      const pElec = volts * current;
      const pShaft = Math.max(0, (current - io) / kv_rad) * omega;
      const eff = pElec > 0 ? (pShaft / pElec) * 100 : 0;
      return { rpm, thrust, current, torque, pElec, eff };
    };

    // 3. Voltage Sweep
    const maxV = Math.max(30, v * 1.2);
    for (let volts = 0; volts <= maxV; volts += 0.5) {
      const res = solveEquilibrium(volts);
      if (res) {
        voltageData.push({
          voltage: Number(volts.toFixed(1)),
          rpm: Math.round(res.rpm),
          thrust: Number((res.thrust * 101.97).toFixed(1)),
          current: Number(res.current.toFixed(1)),
          torque: Number(res.torque.toFixed(4)),
          power: Number(res.pElec.toFixed(1)),
          efficiency: Number(res.eff.toFixed(1)),
        });
      }
    }

    // Calculate exact operating point using the analytical solver (quadratic solution)
    const eqResult = solveEquilibrium(v);
    const equilibriumRpm = eqResult ? eqResult.rpm : 0;
    const opOmega = rpmToRadS(equilibriumRpm);
    const opCurrent = eqResult ? eqResult.current : 0;
    const opThrust = eqResult ? eqResult.thrust : 0;
    const opPower = eqResult ? eqResult.pElec : 0;
    const opShaftPower = eqResult ? Math.max(0, (opCurrent - io) / kv_rad) * opOmega : 0;

    return {
      chartData: data,
      voltageData: voltageData,
      effectiveCoeffs: { ct: eff_ct, cp: eff_cp },
      operatingPoint: {
        rpm: equilibriumRpm,
        thrust: opThrust * 101.97,
        current: opCurrent,
        power: opPower,
        efficiency: opPower > 0 ? (opShaftPower / opPower) * 100 : 0,
        advanceRatio: equilibriumRpm > 0 ? V / (opOmega * propRadius) : 0
      }
    };
  }, [motor, prop, env]);

  const applyPreset = (presetKey: keyof typeof PRESETS) => {
    const p = PRESETS[presetKey];
    setMotor(p.motor);
    setProp(p.prop);
    setEnv(p.env);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 font-sans selection:bg-emerald-500/30">
      {/* Header */}
      <header className="border-b border-white/5 bg-black/40 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Zap className="text-black w-6 h-6 fill-current" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">FPV MOTOR-PROP MATCH</h1>
              <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">Physical Simulation Engine v1.0</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => applyPreset('freestyle6s')}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border border-white/5 hover:bg-white/5 transition-colors text-zinc-400"
            >
              Reset
            </button>
            {(Object.keys(PRESETS) as Array<keyof typeof PRESETS>).map((key) => (
              <button
                key={key}
                onClick={() => applyPreset(key)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-white/5 hover:bg-white/5 transition-colors"
              >
                {PRESETS[key].name}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Sidebar Controls */}
        <aside className="lg:col-span-4 space-y-6">
          {/* Motor Config */}
          <section className="bg-zinc-900/50 border border-white/5 rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Settings2 className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">Motor Parameters</h2>
            </div>
            <div className="space-y-4">
              <InputGroup 
                label="Motor KV" 
                value={motor.kv} 
                unit="RPM/V" 
                onChange={(v) => setMotor({ ...motor, kv: v })} 
                min={100} max={30000} step={10}
              />
              <InputGroup 
                label="Internal Resistance" 
                value={motor.resistance} 
                unit="Ω" 
                onChange={(v) => setMotor({ ...motor, resistance: v })} 
                min={0.01} max={0.5} step={0.001}
              />
              <InputGroup 
                label="No-Load Current" 
                value={motor.noLoadCurrent} 
                unit="A" 
                onChange={(v) => setMotor({ ...motor, noLoadCurrent: v })} 
                min={0.1} max={5} step={0.1}
              />
            </div>
          </section>

          {/* Propeller Config */}
          <section className="bg-zinc-900/50 border border-white/5 rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Wind className="w-4 h-4 text-sky-400" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">Propeller Parameters</h2>
            </div>
            <div className="space-y-4">
              <InputGroup 
                label="Diameter" 
                value={prop.diameter} 
                unit="in" 
                onChange={(v) => setProp({ ...prop, diameter: v })} 
                min={1} max={15} step={0.1}
              />
              <InputGroup 
                label="Pitch" 
                value={prop.pitch} 
                unit="in" 
                onChange={(v) => setProp({ ...prop, pitch: v })} 
                min={1} max={10} step={0.1}
              />
              <div className="grid grid-cols-2 gap-4">
                <InputGroup 
                  label="Ct (Thrust Coeff)" 
                  value={prop.ct} 
                  unit="" 
                  onChange={(v) => setProp({ ...prop, ct: v })} 
                  min={0.01} max={0.3} step={0.01}
                />
                <InputGroup 
                  label="Cp (Power Coeff)" 
                  value={prop.cp} 
                  unit="" 
                  onChange={(v) => setProp({ ...prop, cp: v })} 
                  min={0.01} max={0.2} step={0.01}
                />
              </div>
              <p className="text-[10px] text-zinc-500 italic leading-tight">
                * Ct and Cp are dimensionless coefficients. Typical values range from 0.05 to 0.15.
              </p>
            </div>
          </section>

          {/* Battery Config */}
          <section className="bg-zinc-900/50 border border-white/5 rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-yellow-400" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">Power & Environment</h2>
            </div>
            <div className="space-y-4">
              <InputGroup 
                label="Battery Voltage" 
                value={env.voltage} 
                unit="V" 
                onChange={(v) => setEnv({ ...env, voltage: v })} 
                min={3} max={50} step={0.1}
              />
              <InputGroup 
                label="Flight Velocity" 
                value={env.flightVelocity} 
                unit="m/s" 
                onChange={(v) => setEnv({ ...env, flightVelocity: v })} 
                min={0} max={100} step={1}
              />
              <InputGroup 
                label="Air Density" 
                value={env.airDensity} 
                unit="kg/m³" 
                onChange={(v) => setEnv({ ...env, airDensity: v })} 
                min={0.8} max={1.5} step={0.001}
              />
            </div>
          </section>
        </aside>

        {/* Main Dashboard Content */}
        <div className="lg:col-span-8 space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard 
              label="Operating RPM" 
              value={Math.round(results.operatingPoint.rpm).toLocaleString()} 
              unit="RPM" 
              icon={<Gauge className="w-4 h-4" />}
              color="emerald"
            />
            <MetricCard 
              label="Static Thrust" 
              value={Math.round(results.operatingPoint.thrust).toLocaleString()} 
              unit="g" 
              icon={<TrendingUp className="w-4 h-4" />}
              color="sky"
            />
            <MetricCard 
              label="Current Draw" 
              value={results.operatingPoint.current.toFixed(1)} 
              unit="A" 
              icon={<Activity className="w-4 h-4" />}
              color="yellow"
            />
            <MetricCard 
              label="Efficiency" 
              value={isNaN(results.operatingPoint.efficiency) ? "---" : results.operatingPoint.efficiency.toFixed(1)} 
              unit="%" 
              icon={<Zap className="w-4 h-4" />}
              color="purple"
            />
            <MetricCard 
              label="Power Consumption" 
              value={isNaN(results.operatingPoint.power) ? "---" : results.operatingPoint.power.toFixed(1)} 
              unit="W" 
              icon={<Zap className="w-4 h-4" />}
              color="yellow"
            />
            <MetricCard 
              label="Advance Ratio" 
              value={isNaN(results.operatingPoint.advanceRatio) ? "---" : results.operatingPoint.advanceRatio.toFixed(3)} 
              unit="λ" 
              icon={<TrendingUp className="w-4 h-4" />}
              color="emerald"
            />
            <MetricCard 
              label="Effective Ct" 
              value={results.effectiveCoeffs.ct.toFixed(4)} 
              unit="" 
              icon={<Wind className="w-4 h-4" />}
              color="sky"
            />
            <MetricCard 
              label="Effective Cp" 
              value={results.effectiveCoeffs.cp.toFixed(4)} 
              unit="" 
              icon={<Zap className="w-4 h-4" />}
              color="yellow"
            />
          </div>

          {/* Charts */}
          <div className="bg-zinc-900/50 border border-white/5 rounded-3xl p-8">
            <div className="flex items-center justify-between mb-8 overflow-x-auto">
              <div className="flex gap-2 min-w-max">
                {(['torque', 'thrust', 'efficiency', 'power', 'voltage_response'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${
                      activeTab === tab 
                        ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20' 
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {tab.replace('_', ' ')}
                  </button>
                ))}
              </div>
              <div className="hidden md:flex items-center gap-2 text-[10px] font-mono text-zinc-500 uppercase">
                <Info className="w-3 h-3" />
                Intersection indicates equilibrium
              </div>
            </div>

            <div className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                {activeTab === 'torque' ? (
                  <LineChart data={results.chartData} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                    <XAxis 
                      dataKey="rpm" 
                      type="number"
                      domain={['auto', 'auto']}
                      stroke="#666" 
                      fontSize={10} 
                      tickFormatter={(v) => `${v/1000}k`}
                      label={{ value: 'RPM', position: 'insideBottom', offset: -10, fill: '#666', fontSize: 10 }}
                    />
                    <YAxis stroke="#666" fontSize={10} label={{ value: 'Torque (N·m)', angle: -90, position: 'insideLeft', fill: '#666', fontSize: 10 }} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: '12px', fontSize: '12px' }}
                      itemStyle={{ color: '#fff' }}
                    />
                    <Legend verticalAlign="top" height={36}/>
                    <Line type="monotone" dataKey="motorTorque" name="Motor Torque" stroke="#10b981" strokeWidth={3} dot={false} animationDuration={1000} />
                    <Line type="monotone" dataKey="propTorque" name="Prop Torque" stroke="#0ea5e9" strokeWidth={3} dot={false} animationDuration={1000} />
                    {results.operatingPoint.rpm > 0 && (
                      <ReferenceLine x={results.operatingPoint.rpm} stroke="#f59e0b" strokeDasharray="5 5" isFront={true} label={{ value: 'Equilibrium', fill: '#f59e0b', fontSize: 10, position: 'top' }} />
                    )}
                  </LineChart>
                ) : activeTab === 'thrust' ? (
                  <AreaChart data={results.chartData} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                    <defs>
                      <linearGradient id="colorThrust" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                    <XAxis 
                      dataKey="rpm" 
                      type="number"
                      domain={['auto', 'auto']}
                      stroke="#666" 
                      fontSize={10} 
                      tickFormatter={(v) => `${v/1000}k`}
                      label={{ value: 'RPM', position: 'insideBottom', offset: -10, fill: '#666', fontSize: 10 }}
                    />
                    <YAxis stroke="#666" fontSize={10} label={{ value: 'Thrust (g)', angle: -90, position: 'insideLeft', fill: '#666', fontSize: 10 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: '12px', fontSize: '12px' }} />
                    {results.operatingPoint.rpm > 0 && (
                      <ReferenceLine x={results.operatingPoint.rpm} stroke="#f59e0b" strokeDasharray="5 5" isFront={true} />
                    )}
                    <Area type="monotone" dataKey="thrust" name="Thrust (g)" stroke="#0ea5e9" fillOpacity={1} fill="url(#colorThrust)" strokeWidth={3} />
                  </AreaChart>
                ) : activeTab === 'efficiency' ? (
                  <LineChart data={results.chartData} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                    <XAxis 
                      dataKey="rpm" 
                      type="number"
                      domain={['auto', 'auto']}
                      stroke="#666" 
                      fontSize={10} 
                      tickFormatter={(v) => `${v/1000}k`}
                      label={{ value: 'RPM', position: 'insideBottom', offset: -10, fill: '#666', fontSize: 10 }}
                    />
                    <YAxis stroke="#666" fontSize={10} label={{ value: 'Efficiency (%)', angle: -90, position: 'insideLeft', fill: '#666', fontSize: 10 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: '12px', fontSize: '12px' }} />
                    <Line type="monotone" dataKey="efficiency" name="Motor Efficiency (%)" stroke="#a855f7" strokeWidth={3} dot={false} />
                    {results.operatingPoint.rpm > 0 && (
                      <ReferenceLine x={results.operatingPoint.rpm} stroke="#f59e0b" strokeDasharray="5 5" isFront={true} />
                    )}
                  </LineChart>
                ) : activeTab === 'power' ? (
                  <AreaChart data={results.chartData} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                    <defs>
                      <linearGradient id="colorProp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorShaft" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorElec" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                    <XAxis 
                      dataKey="rpm" 
                      type="number"
                      domain={['auto', 'auto']}
                      stroke="#666" 
                      fontSize={10} 
                      tickFormatter={(v) => `${v/1000}k`}
                      label={{ value: 'RPM', position: 'insideBottom', offset: -10, fill: '#666', fontSize: 10 }}
                    />
                    <YAxis stroke="#666" fontSize={10} label={{ value: 'Power (W)', angle: -90, position: 'insideLeft', fill: '#666', fontSize: 10 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: '12px', fontSize: '12px' }} />
                    <Legend verticalAlign="top" height={36}/>
                    <Area type="monotone" dataKey="pElec" name="P Elec (Input, F4)" stroke="#ef4444" fillOpacity={1} fill="url(#colorElec)" strokeWidth={2} />
                    <Area type="monotone" dataKey="pShaftMotor" name="P Shaft (Motor Out, F3)" stroke="#10b981" fillOpacity={1} fill="url(#colorShaft)" strokeWidth={2} />
                    <Area type="monotone" dataKey="pProp" name="P Prop (Absorbed)" stroke="#f59e0b" fillOpacity={1} fill="url(#colorProp)" strokeWidth={3} />
                    {results.operatingPoint.rpm > 0 && (
                      <ReferenceLine x={results.operatingPoint.rpm} stroke="#f59e0b" strokeDasharray="5 5" isFront={true} />
                    )}
                  </AreaChart>
                ) : (
                  <LineChart data={results.voltageData} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                    <XAxis 
                      dataKey="voltage" 
                      type="number"
                      domain={[0, 'auto']}
                      stroke="#666" 
                      fontSize={10} 
                      label={{ value: 'Voltage (V)', position: 'insideBottom', offset: -10, fill: '#666', fontSize: 10 }}
                    />
                    <YAxis yAxisId="left" stroke="#666" fontSize={10} label={{ value: 'RPM / Thrust / Power', angle: -90, position: 'insideLeft', fill: '#666', fontSize: 10 }} />
                    <YAxis yAxisId="right" orientation="right" stroke="#666" fontSize={10} label={{ value: 'Current / Efficiency / Torque', angle: 90, position: 'insideRight', fill: '#666', fontSize: 10 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: '12px', fontSize: '12px' }} />
                    <Legend verticalAlign="top" height={36}/>
                    <Line yAxisId="left" type="monotone" dataKey="rpm" name="RPM" stroke="#10b981" strokeWidth={2} dot={false} />
                    <Line yAxisId="left" type="monotone" dataKey="thrust" name="Thrust (g)" stroke="#0ea5e9" strokeWidth={2} dot={false} />
                    <Line yAxisId="left" type="monotone" dataKey="power" name="Power (W)" stroke="#f59e0b" strokeWidth={2} dot={false} />
                    <Line yAxisId="right" type="monotone" dataKey="current" name="Current (A)" stroke="#ef4444" strokeWidth={2} dot={false} />
                    <Line yAxisId="right" type="monotone" dataKey="efficiency" name="Efficiency (%)" stroke="#a855f7" strokeWidth={2} dot={false} />
                    <ReferenceLine x={env.voltage} stroke="#fff" strokeDasharray="5 5" isFront={true} label={{ value: 'Current V', fill: '#fff', fontSize: 10, position: 'top' }} />
                  </LineChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>

          {/* Detailed Analysis */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-6">
              <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Performance Summary
              </h3>
              <ul className="space-y-3 text-sm">
                <li className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-zinc-400">Max Theoretical RPM</span>
                  <span className="font-mono">{(motor.kv * env.voltage).toLocaleString()}</span>
                </li>
                <li className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-zinc-400">Operating Load</span>
                  <span className="font-mono">{(motor.kv * env.voltage) > 0 ? ((results.operatingPoint.rpm / (motor.kv * env.voltage)) * 100).toFixed(1) : "---"}%</span>
                </li>
                <li className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-zinc-400">Power Consumption</span>
                  <span className="font-mono">{results.operatingPoint.power.toFixed(1)} W</span>
                </li>
                <li className="flex justify-between">
                  <span className="text-zinc-400">Thrust-to-Power</span>
                  <span className="font-mono text-emerald-400">{results.operatingPoint.power > 0 ? (results.operatingPoint.thrust / results.operatingPoint.power).toFixed(2) : "---"} g/W</span>
                </li>
              </ul>
            </div>
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-6">
              <h3 className="text-sm font-bold uppercase tracking-widest text-emerald-500 mb-4">Optimization Tip</h3>
              <p className="text-sm text-zinc-300 leading-relaxed">
                {results.operatingPoint.efficiency > 80 
                  ? "Your system is well-matched. The motor is operating near its peak efficiency band."
                  : results.operatingPoint.rpm / (motor.kv * env.voltage) < 0.6
                  ? "The motor is heavily loaded. Consider a lower pitch propeller or a motor with higher torque (lower KV or larger stator)."
                  : "The motor is lightly loaded. You could potentially use a more aggressive propeller for more thrust without excessive heat."}
              </p>
              <div className="mt-4 flex items-center gap-2 text-xs text-emerald-400 font-medium cursor-pointer hover:underline">
                Learn more about impedance matching <ChevronRight className="w-3 h-3" />
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-6 py-12 border-t border-white/5">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-zinc-500 text-xs font-mono">
            © 2026 FPV DYNAMICS LAB. ALL RIGHTS RESERVED.
          </div>
          <div className="flex gap-8">
            <a href="#" className="text-zinc-500 hover:text-white text-xs uppercase tracking-widest font-bold transition-colors">Documentation</a>
            <a href="#" className="text-zinc-500 hover:text-white text-xs uppercase tracking-widest font-bold transition-colors">Github</a>
            <a href="#" className="text-zinc-500 hover:text-white text-xs uppercase tracking-widest font-bold transition-colors">Support</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

// --- Sub-components ---

function InputGroup({ label, value, unit, onChange, min, max, step }: { 
  label: string, value: number, unit: string, onChange: (v: number) => void, min: number, max: number, step: number 
}) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [tempValue, setTempValue] = React.useState(value.toString());

  const handleBlur = () => {
    setIsEditing(false);
    const num = parseFloat(tempValue);
    if (!isNaN(num)) {
      onChange(num);
    } else {
      setTempValue(value.toString());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleBlur();
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <label className="text-[10px] uppercase font-bold tracking-wider text-zinc-500">{label}</label>
        <div className="flex items-center gap-1">
          {isEditing ? (
            <input
              autoFocus
              type="number"
              value={tempValue}
              onChange={(e) => setTempValue(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              className="w-16 bg-zinc-800 border border-emerald-500/50 rounded px-1 text-xs font-mono text-emerald-400 focus:outline-none"
            />
          ) : (
            <span 
              onClick={() => {
                setTempValue(value.toString());
                setIsEditing(true);
              }}
              className="text-xs font-mono text-zinc-300 cursor-pointer hover:text-emerald-400 transition-colors border-b border-dashed border-zinc-600"
            >
              {value}
            </span>
          )}
          <span className="text-[10px] text-zinc-500 font-mono">{unit}</span>
        </div>
      </div>
      <input 
        type="range" 
        min={min} 
        max={max} 
        step={step} 
        value={value} 
        onChange={(e) => {
          const val = parseFloat(e.target.value);
          onChange(val);
          setTempValue(val.toString());
        }}
        className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
      />
    </div>
  );
}

function MetricCard({ label, value, unit, icon, color }: { label: string, value: string, unit: string, icon: React.ReactNode, color: string }) {
  const colors: Record<string, string> = {
    emerald: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
    sky: 'text-sky-400 bg-sky-400/10 border-sky-400/20',
    yellow: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
    purple: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`p-4 rounded-2xl border ${colors[color]} flex flex-col justify-between h-32`}
    >
      <div className="flex justify-between items-start">
        <span className="text-[10px] font-bold uppercase tracking-widest opacity-70">{label}</span>
        {icon}
      </div>
      <div>
        <div className="text-2xl font-bold tracking-tight">{value}</div>
        <div className="text-[10px] font-mono uppercase opacity-50">{unit}</div>
      </div>
    </motion.div>
  );
}
