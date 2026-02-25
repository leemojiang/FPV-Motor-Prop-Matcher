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

    # --- 4. 核心计算循环 (Core Calculation Loop) ---
    for omega in omegas:
        # (6) i(Omega, v) = (v - Omega/Kv) / R
        i = max(0, (v_batt - omega / kv_rad) / R)
        
        # (1) Qm(i) = (i - io) / Kv
        qm = max(0, (i - io) / kv_rad)
        
        # (4) Pelec = v * i
        p_elec = v_batt * i
        # (3) Pshaft = Qm * Omega
        p_shaft = qm * omega
        # (5) n_m = Pshaft / Pelec
        eff = (p_shaft / p_elec * 100) if p_elec > 0 else 0
        
        # 螺旋桨计算 (Propeller Calculations)
        tip_speed = omega * prop_radius
        
        # (14) lambda = V / (Omega * R)
        advance_ratio = V_flight / tip_speed if tip_speed > 0 else 0
        
        # 进气比修正 (Advance Ratio Correction - 简化线性模型)
        lambda0 = (pitch_in / diameter_in) * 1.2
        ct_eff = max(0, ct_static * (1 - advance_ratio / lambda0))
        cp_eff = max(0, cp_static * (1 - advance_ratio / lambda0))

        # (15) T = 0.5 * rho * (Omega * R)^2 * pi * R^2 * Ct
        thrust_n = 0.5 * rho * (tip_speed**2) * np.pi * (prop_radius**2) * ct_eff
        # (16) Q = 0.5 * rho * (Omega * R)^2 * pi * R^3 * Cp
        q_prop = 0.5 * rho * (tip_speed**2) * np.pi * (prop_radius**3) * cp_eff

        motor_torques.append(qm)
        prop_torques.append(q_prop)
        thrusts_g.append(thrust_n * 101.97) # N to grams
        efficiencies.append(eff)
        currents.append(i)

    # --- 5. 寻找平衡点 (Find Equilibrium Point) ---
    # (17) Qm(Omega, v) = Q(Omega, V)
    diff = np.abs(np.array(motor_torques) - np.array(prop_torques))
    idx = np.argmin(diff[10:]) + 10 # 避开低速启动区
    eq_rpm = rpms[idx]
    eq_thrust = thrusts_g[idx]
    eq_current = currents[idx]
    eq_eff = efficiencies[idx]

    # --- 6. 输出结果 (Output Results) ---
    print(f"--- FPV Dynamics Math Check ---")
    print(f"Operating Point (平衡点):")
    print(f"  RPM:         {eq_rpm:.0f}")
    print(f"  Thrust:      {eq_thrust:.1f} g")
    print(f"  Current:     {eq_current:.1f} A")
    print(f"  Efficiency:  {eq_eff:.1f} %")
    print(f"  Power:       {eq_current * v_batt:.1f} W")

    # --- 7. 绘图 (Plotting) ---
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))

    # 图表 1: 扭矩匹配 (Torque Matching)
    ax1.plot(rpms, motor_torques, label='Motor Torque (Qm)', color='green', linewidth=2)
    ax1.plot(rpms, prop_torques, label='Prop Torque (Q)', color='blue', linewidth=2)
    ax1.axvline(eq_rpm, color='red', linestyle='--', alpha=0.5, label=f'Equilibrium @ {eq_rpm:.0f} RPM')
    ax1.set_title('Torque vs RPM (Formula 17 Matching)')
    ax1.set_xlabel('RPM')
    ax1.set_ylabel('Torque (N·m)')
    ax1.grid(True, alpha=0.3)
    ax1.legend()

    # 图表 2: 推力与效率 (Thrust & Efficiency)
    ax2.plot(rpms, thrusts_g, label='Thrust (g)', color='orange', linewidth=2)
    ax2_eff = ax2.twinx()
    ax2_eff.plot(rpms, efficiencies, label='Efficiency (%)', color='purple', linestyle=':', linewidth=2)
    ax2.set_title('Thrust and Efficiency vs RPM')
    ax2.set_xlabel('RPM')
    ax2.set_ylabel('Thrust (g)')
    ax2_eff.set_ylabel('Efficiency (%)')
    ax2.grid(True, alpha=0.3)
    
    # 合并图例
    lines, labels = ax2.get_legend_handles_labels()
    lines2, labels2 = ax2_eff.get_legend_handles_labels()
    ax2.legend(lines + lines2, labels + labels2, loc='upper left')

    plt.tight_layout()
    plt.show()

if __name__ == "__main__":
    simulate_fpv_dynamics()
