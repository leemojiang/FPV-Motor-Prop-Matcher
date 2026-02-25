import numpy as np
import matplotlib.pyplot as plt

def simulate_fpv_dynamics():
    # --- 1. 输入参数 (Input Parameters) ---
    # 电机参数 (Motor Parameters)
    kv_rpm = 1750      # RPM/V
    R = 0.045          # 内阻 (Resistance), Ohms
    io = 1.2           # 空载电流 (No-load current), Amps
    
    # 螺旋桨参数 (Propeller Parameters)
    diameter_in = 5.1  # 直径, inches
    pitch_in = 4.3     # 螺距, inches
    ct_static = 0.11   # 推力系数 (Thrust coefficient)
    cp_static = 0.05   # 功率系数 (Power coefficient)
    
    # 环境与电源 (Environment & Power)
    v_batt = 22.2      # 电压 (Voltage), Volts
    rho = 1.225        # 空气密度 (Air density), kg/m^3
    V_flight = 0       # 飞行速度 (Flight velocity), m/s

    # --- 2. 物理常数与转换 (Constants & Conversions) ---
    kv_rad = (kv_rpm * 2 * np.pi) / 60  # 转换为 rad/s/V
    prop_radius = (diameter_in * 0.0254) / 2 # 转换为 meters
    
    # --- 3. 计算范围 (Calculation Range) ---
    max_rpm = kv_rpm * v_batt
    rpms = np.linspace(0, max_rpm, 200)
    omegas = (rpms * 2 * np.pi) / 60

    motor_torques = []
    prop_torques = []
    thrusts_g = []
    efficiencies = []
    currents = []
    powers = []

    # --- 4. 核心计算循环 (Core Calculation Loop) ---
    for omega in omegas:
        # (6) i(Omega, v) = (v - Omega/Kv) / R
        i = max(0, (v_batt - omega / kv_rad) / R)
        
        # (1) Qm(i) = (i - io) / Kv
        qm = max(0, (i - io) / kv_rad)
        
        # (4) Pelec = v * i
        p_elec = v_batt * i
        # (3) Pshaft = Qm * omega
        p_shaft = qm * omega
        # (5) n_m = Pshaft / Pelec
        eff = (p_shaft / p_elec * 100) if p_elec > 0 else 0
        
        # 螺旋桨计算 (Propeller Calculations)
        tip_speed = omega * prop_radius
        
        # (14) lambda = V / (Omega * R)
        advance_ratio = V_flight / tip_speed if tip_speed > 0 else 0
        
        # 进气比修正与 Pitch 影响
        # pitchRatio = P/D. 
        pitch_ratio = pitch_in / diameter_in
        base_ct = ct_static * pitch_ratio
        base_cp = cp_static * pitch_ratio

        # lambda_0 is roughly pitch/diameter * factor
        lambda0 = pitch_ratio * 1.2
        ct_eff = max(0, base_ct * (1 - advance_ratio / lambda0))
        cp_eff = max(0, base_cp * (1 - advance_ratio / lambda0))

        # (15) T = 0.5 * rho * (Omega * R)^2 * pi * R^2 * Ct
        thrust_n = 0.5 * rho * (tip_speed**2) * np.pi * (prop_radius**2) * ct_eff
        # (16) Q = 0.5 * rho * (Omega * R)^2 * pi * R^3 * Cp
        q_prop = 0.5 * rho * (tip_speed**2) * np.pi * (prop_radius**3) * cp_eff

        motor_torques.append(qm)
        prop_torques.append(q_prop)
        thrusts_g.append(thrust_n * 101.97) # N to grams
        efficiencies.append(eff)
        
        # (9) Propeller Efficiency: eta_p = (T * V) / P_prop
        p_prop = q_prop * omega
        prop_eff = (thrust_n * V_flight / p_prop * 100) if p_prop > 0 else 0
        prop_efficiencies.append(min(100, prop_eff))
        
        currents.append(i)
        powers_elec.append(p_elec)
        powers_shaft.append(p_shaft)
        powers_prop.append(p_prop)
        lambdas.append(advance_ratio)

    # --- 5. 寻找平衡点 (Find Equilibrium Point) ---
    # (17) Qm(Omega, v) = Q(Omega, V)
    diff = np.abs(np.array(motor_torques) - np.array(prop_torques))
    idx = np.argmin(diff[10:]) + 10 # 避开低速启动区
    eq_rpm = rpms[idx]
    eq_thrust = thrusts_g[idx]
    eq_current = currents[idx]
    eq_eff = efficiencies[idx]
    eq_p_elec = powers_elec[idx]
    eq_p_shaft = powers_shaft[idx]
    eq_p_prop = powers_prop[idx]
    eq_lambda = lambdas[idx]

    # --- 6. 输出结果 (Output Results) ---
    print(f"--- FPV Dynamics Math Check ---")
    print(f"Operating Point (平衡点):")
    print(f"  RPM:            {eq_rpm:.0f}")
    print(f"  Thrust:         {eq_thrust:.1f} g")
    print(f"  Current:        {eq_current:.1f} A")
    print(f"  Motor Eff:      {eq_eff:.1f} %")
    print(f"  P Elec (In):    {eq_p_elec:.1f} W")
    print(f"  P Shaft (Out):  {eq_p_shaft:.1f} W")
    print(f"  P Prop (Abs):   {eq_p_prop:.1f} W")
    print(f"  Advance Ratio:  {eq_lambda:.3f}")

    # --- 7. 绘图 (Plotting) ---
    fig, axes = plt.subplots(2, 2, figsize=(16, 10))
    ((ax1, ax2), (ax3, ax4)) = axes

    # 图表 1: 扭矩匹配 (Torque Matching)
    ax1.plot(rpms, motor_torques, label='Motor Torque (Qm)', color='green', linewidth=2)
    ax1.plot(rpms, prop_torques, label='Prop Torque (Q)', color='blue', linewidth=2)
    ax1.axvline(eq_rpm, color='red', linestyle='--', alpha=0.5, label=f'Equilibrium @ {eq_rpm:.0f} RPM')
    ax1.set_title('Torque vs RPM (Formula 17 Matching)')
    ax1.set_xlabel('RPM')
    ax1.set_ylabel('Torque (N·m)')
    ax1.grid(True, alpha=0.3)
    ax1.legend()

    # 图表 2: 功率对比 (Power Comparison)
    ax2.plot(rpms, powers_elec, label='P Elec (Input, F4)', color='red', linewidth=2)
    ax2.plot(rpms, powers_shaft, label='P Shaft (Motor Out, F3)', color='green', linewidth=2, linestyle='--')
    ax2.plot(rpms, powers_prop, label='P Prop (Absorbed)', color='orange', linewidth=2)
    ax2.axvline(eq_rpm, color='black', linestyle='--', alpha=0.3)
    ax2.set_title('Power vs RPM (Energy Flow)')
    ax2.set_xlabel('RPM')
    ax2.set_ylabel('Power (W)')
    ax2.grid(True, alpha=0.3)
    ax2.legend()

    # 图表 3: 螺旋桨特性 vs RPM (Propeller Characteristics vs RPM)
    ax3.plot(rpms, thrusts_g, label='Thrust (g)', color='blue')
    ax3_eff = ax3.twinx()
    ax3_eff.plot(rpms, prop_efficiencies, label='Prop Eff (%)', color='purple', linestyle='--')
    ax3.set_title('Propeller Characteristics vs RPM')
    ax3.set_xlabel('RPM')
    ax3.set_ylabel('Thrust (g)')
    ax3_eff.set_ylabel('Efficiency (%)')
    ax3.grid(True, alpha=0.3)
    ax3.legend(loc='upper left')
    ax3_eff.legend(loc='upper right')

    # 图表 4: 螺旋桨特性 vs Lambda (Propeller Characteristics vs Lambda)
    # Filter out very high lambdas for better visualization
    valid_mask = np.array(lambdas) < (pitch_in/diameter_in * 1.5)
    ax4.plot(np.array(lambdas)[valid_mask], np.array(thrusts_g)[valid_mask], label='Thrust (g)', color='blue')
    ax4_eff = ax4.twinx()
    ax4_eff.plot(np.array(lambdas)[valid_mask], np.array(prop_efficiencies)[valid_mask], label='Prop Eff (%)', color='purple', linestyle='--')
    ax4.axvline(eq_lambda, color='red', linestyle=':', label=f'Operating λ={eq_lambda:.3f}')
    ax4.set_title('Propeller Characteristics vs Advance Ratio (λ)')
    ax4.set_xlabel('Advance Ratio (λ)')
    ax4.set_ylabel('Thrust (g)')
    ax4_eff.set_ylabel('Efficiency (%)')
    ax4.grid(True, alpha=0.3)
    ax4.legend(loc='upper left')
    ax4_eff.legend(loc='upper right')

    plt.tight_layout()
    plt.show()

if __name__ == "__main__":
    simulate_fpv_dynamics()
