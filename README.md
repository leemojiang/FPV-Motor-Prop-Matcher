# FPV Motor-Prop Matcher

![Version](https://img.shields.io/badge/version-1.0.0-emerald)
![License](https://img.shields.io/badge/license-Apache--2.0-blue)

一个基于物理建模的穿越机（FPV）电动机与螺旋桨匹配可视化仿真工具。通过输入电机 KV、内阻、电池电压以及螺旋桨参数，实时模拟动力系统的运行状态、推力输出及效率表现。

[Click Here To Visit 🤗] (https://fpv-motor-prop-matcher.vercel.app/)

## 🚀 功能特性

- **物理仿真引擎**：基于直流电机等效电路模型与螺旋桨空气动力学公式。
- **实时可视化**：
  - **扭矩匹配图**：直观展示电机输出扭矩与螺旋桨负载扭矩的平衡点。
  - **推力曲线**：模拟不同转速下的静态推力输出。
  - **效率分析**：计算电机在不同负载下的转换效率。
- **高度可定制**：
  - 支持 **100 - 30,000 KV** 的超广范围。
  - 所有参数支持 **滑动条调节** 或 **点击数字手动输入**。
  - 考虑 **飞行速度 (Flight Velocity)** 对推力的动态影响（进气比修正）。
- **内置预设**：一键切换 5" Freestyle, 5" Racing, 7" Long Range, Sub-250g 等经典配置。

## 📚 物理模型说明

本项目参考了经典的直流电机与螺旋桨匹配理论，核心公式如下：

### 1. 电机模型 (Motor Model)
- **电机扭矩 (Formula 1)**: $Q_m = \frac{i - i_o}{K_v}$
- **转速 (Formula 2)**: $\Omega = (v - iR)K_v$
- **电流 (Formula 6)**: $i = \frac{v - \Omega/K_v}{R}$
- **轴输出功率 (Formula 3)**: $P_{shaft} = Q_m \Omega = (i - i_o)(v - iR)$
- **输入电功率 (Formula 4)**: $P_{elec} = v \cdot i$
- **电机效率 (Formula 5)**: $\eta_m = \frac{P_{shaft}}{P_{elec}} = (1 - \frac{i_o}{i})(1 - \frac{iR}{v})$

### 2. 螺旋桨模型 (Propeller Model - Simplified)
螺旋桨的推力和扭矩由无量纲系数 $C_T$ 和 $C_P$ 决定。因为FPV一般工作在 $\lambda \approx 0$ 的附近,所以我们移除了进气比 $\lambda$ 的动态修正，改用基于桨距修正的有效系数 (事实上这两个系数受到$\lambda$和螺旋桨几何因素影响,并没有准确的解析公式,这个修正只是为了说明大概趋势,请确保$C_{T,eff},C_{P,eff}$与实际测量值接近.) ：
- **有效系数**:
  - $C_{T,eff} = C_{T,static} \times (Pitch / Diameter)$
  - $C_{P,eff} = C_{P,static} \times (Pitch / Diameter)$
- **推力 (Formula 15)**: $T = \frac{1}{2} \rho (\Omega R)^2 \pi R^2 C_{T,eff}$
- **扭矩 (Formula 16)**: $Q = \frac{1}{2} \rho (\Omega R)^2 \pi R^3 C_{P,eff}$
- **螺旋桨吸收功率 (Propeller Power)**: $P_{prop} = Q \cdot \Omega$

### 3. 匹配与平衡 (Matching)
- **平衡条件 (Formula 17)**: 寻找 $\Omega$ 使得 $Q_m(\Omega, v) = Q(\Omega)$。
- **运行负载率 (Operating Load)**: 
  $$\text{Operating Load} = \frac{\Omega_{actual}}{\Omega_{no-load}} \times 100\% = \frac{\Omega_{actual}}{v \cdot K_v} \times 100\%$$
  该指标反映了电机在当前负载下的转速跌落。通常 70%-85% 为理想区间，低于 60% 说明负载过重，电机发热会显著增加。
- **解析解**: 系统通过求解二次方程 $a\Omega^2 + b\Omega + c = 0$ 直接获取精确的平衡转速。

## 📊 图表说明

- **Torque**: 展示电机输出扭矩与螺旋桨负载扭矩的交点（平衡点）。
- **Thrust**: 随转速变化的推力输出。
- **Efficiency**: 电机转换效率（电能转机械能）。
- **Power**: 同时绘制 **P Elec (输入电功率)**、**P Shaft (电机轴输出功率)** 与 **P Prop (螺旋桨吸收功率)**。
- **Voltage Response**: **动态响应分析**。展示随电池电压（0V - 30V+）变化的平衡转速、推力、电流、功率及效率曲线。

## 🛠️ 技术栈

- **前端框架**: React 19 + TypeScript
- **构建工具**: Vite 6
- **样式处理**: Tailwind CSS 4
- **图表库**: Recharts
- **动画库**: Motion (Framer Motion)
- **图标库**: Lucide React

## 📦 快速开始

### 本地开发

1.  **克隆仓库**
    ```bash
    git clone <your-repo-url>
    cd fpv-motor-prop-matcher
    ```

2.  **安装依赖**
    ```bash
    npm install
    ```

3.  **启动开发服务器**
    ```bash
    npm run dev
    ```

4.  **构建生产版本**
    ```bash
    npm run build
    ```

### 数学检查脚本

项目中包含一个 `fpv_math_check.py` 脚本，用于离线验证物理模型的准确性。
```bash
pip install numpy matplotlib
python fpv_math_check.py
```

## 🌐 部署

本项目为纯前端应用（SPA），可轻松部署至：
- **Vercel / Netlify**: 关联 GitHub 仓库即可自动部署。
- **GitHub Pages**: 使用 `gh-pages` 分支进行部署。
- **Nginx**: 将 `dist/` 目录下的内容拷贝至 Nginx 静态资源目录。

## 📄 开源协议

本项目采用 [Apache-2.0](LICENSE) 协议开源。

## Reference
[Lecture Notes from MIT](https://web.mit.edu/drela/Public/web/qprop/motorprop.pdf)

---
*Developed with ❤️ for the FPV Community.*
