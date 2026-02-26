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
    prop_efficiencies = []
    currents = []
    powers_elec = []
    powers_shaft = []
    powers_prop = []
    lambdas = []

    # --- 4. 核心计算循环 (Core Calculation Loop) ---
    # 螺旋桨常数 k (Torque = k * omega^2)
    pitch_ratio = pitch_in / diameter_in
    eff_ct = ct_static * pitch_ratio
    eff_cp = cp_static * pitch_ratio
    
    # Q = 0.5 * rho * (omega * R)^2 * pi * R^3 * Cp = (0.5 * rho * pi * R^5 * Cp) * omega^2
    k_prop = 0.5 * rho * np.pi * (prop_radius**5) * eff_cp
    k_thrust = 0.5 * rho * np.pi * (prop_radius**4) * eff_ct

    for omega in omegas:
        # (6) i(Omega, v) = (v - Omega/Kv) / R
        i = max(0, (v_batt - omega / kv_rad) / R)
        qm = max(0, (i - io) / kv_rad)
        p_elec = v_batt * i
        p_shaft = qm * omega
        eff = (p_shaft / p_elec * 100) if p_elec > 0 else 0
        
        # 螺旋桨计算 (Simplified)
        q_prop = k_prop * (omega**2)
        thrust_n = k_thrust * (omega**2)
        p_prop = q_prop * omega
        
        motor_torques.append(qm)
        prop_torques.append(q_prop)
        thrusts_g.append(thrust_n * 101.97)
        efficiencies.append(eff)
        currents.append(i)
        powers_elec.append(p_elec)
        powers_shaft.append(p_shaft)
        powers_prop.append(p_prop)

    # --- 5. 电压响应分析 (Voltage Response Analysis) ---
    def solve_equilibrium(v_sweep):
        # a*omega^2 + b*omega + c = 0
        a = k_prop
        b = 1 / (R * (kv_rad**2))
        c = (io / kv_rad) - (v_sweep / (R * kv_rad))
        
        discriminant = b**2 - 4*a*c
        if discriminant < 0: return None
        
        omega = (-b + np.sqrt(discriminant)) / (2 * a)
        if omega < 0: return None
        
        rpm = (omega * 60) / (2 * np.pi)
        current = max(0, (v_sweep - omega / kv_rad) / R)
        thrust = k_thrust * (omega**2)
        p_elec = v_sweep * current
        eff = ( ( (current-io)/kv_rad * omega ) / p_elec * 100) if p_elec > 0 else 0
        return rpm, thrust * 101.97, current, p_elec, eff

    v_range = np.linspace(0, 30, 100)
    v_res = [solve_equilibrium(v) for v in v_range]
    v_res = [r for r in v_res if r is not None]
    v_plot = v_range[:len(v_res)]
    
    # --- 6. 输出结果 (Output Results) ---
    eq_res = solve_equilibrium(v_batt)
    print(f"--- FPV Dynamics Math Check ---")
    print(f"Operating Point (平衡点 @ {v_batt}V):")
    if eq_res:
        rpm_actual = eq_res[0]
        rpm_no_load = v_batt * motor_kv
        load_pct = (rpm_actual / rpm_no_load * 100) if rpm_no_load > 0 else 0
        
        print(f"  RPM:            {rpm_actual:.0f}")
        print(f"  No-load RPM:    {rpm_no_load:.0f}")
        print(f"  Operating Load: {load_pct:.1f} %")
        print(f"  Thrust:         {eq_res[1]:.1f} g")
        print(f"  Current:        {eq_res[2]:.1f} A")
        print(f"  Power:          {eq_res[3]:.1f} W")
        print(f"  Efficiency:     {eq_res[4]:.1f} %")
    print(f"  Effective Ct:   {eff_ct:.4f}")
    print(f"  Effective Cp:   {eff_cp:.4f}")

    # --- 7. 绘图 (Plotting) ---
    fig, axes = plt.subplots(2, 2, figsize=(16, 10))
    ((ax1, ax2), (ax3, ax4)) = axes

    # 图表 1: 扭矩匹配
    ax1.plot(rpms, motor_torques, label='Motor Torque', color='green')
    ax1.plot(rpms, prop_torques, label='Prop Torque', color='blue')
    if eq_res: ax1.axvline(eq_res[0], color='red', linestyle='--')
    ax1.set_title('Torque Matching')
    ax1.set_xlabel('RPM')
    ax1.set_ylabel('Torque (N·m)')
    ax1.grid(True, alpha=0.3)
    ax1.legend()

    # 图表 2: 功率对比
    ax2.plot(rpms, powers_elec, label='P Elec', color='red')
    ax2.plot(rpms, powers_shaft, label='P Shaft', color='green', linestyle='--')
    ax2.plot(rpms, powers_prop, label='P Prop', color='orange')
    ax2.set_title('Energy Flow')
    ax2.set_xlabel('RPM')
    ax2.set_ylabel('Power (W)')
    ax2.grid(True, alpha=0.3)
    ax2.legend()

    # 图表 3: 推力与效率
    ax3.plot(rpms, thrusts_g, label='Thrust (g)', color='blue')
    ax3_eff = ax3.twinx()
    ax3_eff.plot(rpms, efficiencies, label='Motor Eff (%)', color='purple', linestyle='--')
    ax3.set_title('Thrust & Efficiency vs RPM')
    ax3.grid(True, alpha=0.3)

    # 图表 4: 电压响应 (Voltage Response)
    if v_res:
        v_data = np.array(v_res)
        ax4.plot(v_plot, v_data[:, 0], label='RPM', color='green')
        ax4.plot(v_plot, v_data[:, 1], label='Thrust (g)', color='blue')
        ax4_p = ax4.twinx()
        ax4_p.plot(v_plot, v_data[:, 2], label='Current (A)', color='red', linestyle='--')
        ax4_p.plot(v_plot, v_data[:, 4], label='Eff (%)', color='purple', linestyle=':')
        ax4.set_title('Dynamic Voltage Response')
        ax4.set_xlabel('Voltage (V)')
        ax4.legend(loc='upper left')
        ax4_p.legend(loc='upper right')
        ax4.grid(True, alpha=0.3)

    plt.tight_layout()
    plt.show()

    plt.tight_layout()
    plt.show()

if __name__ == "__main__":
    simulate_fpv_dynamics()
