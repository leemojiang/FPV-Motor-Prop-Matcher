# FPV Motor-Prop Matcher

![Version](https://img.shields.io/badge/version-1.0.0-emerald)
![License](https://img.shields.io/badge/license-Apache--2.0-blue)

一个基于物理建模的穿越机（FPV）电动机与螺旋桨匹配可视化仿真工具。通过输入电机 KV、内阻、电池电压以及螺旋桨参数，实时模拟动力系统的运行状态、推力输出及效率表现。

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
- **轴输出功率 (Formula 3)**: $P_{shaft} = Q_m \Omega = (i - i_o)(v - iR)$
- **输入电功率 (Formula 4)**: $P_{elec} = v \cdot i$
- **电机效率 (Formula 5)**: $\eta_m = \frac{P_{shaft}}{P_{elec}} = (1 - \frac{i_o}{i})(1 - \frac{iR}{v})$

### 2. 螺旋桨模型 (Propeller Model)
螺旋桨的推力和扭矩由无量纲系数 $C_T$ 和 $C_P$ 决定，并受进气比 $\lambda$ 影响：
- **进气比 (Formula 14)**: $\lambda = \frac{V}{\Omega R}$
- **推力 (Formula 15)**: $T = \frac{1}{2} \rho (\Omega R)^2 \pi R^2 C_T(\lambda)$
- **扭矩 (Formula 16)**: $Q = \frac{1}{2} \rho (\Omega R)^2 \pi R^3 C_P(\lambda)$
- **螺旋桨吸收功率 (Propeller Power)**: $P_{prop} = Q \cdot \Omega$
- **螺旋桨效率 (Propeller Efficiency)**: $\eta_p = \frac{T \cdot V}{P_{prop}}$

> **注**：在本项目中，我们引入了 $Pitch/Diameter$（桨径比）对基础系数的修正，以更真实地模拟不同螺距桨叶的负载差异。

### 3. 匹配与平衡 (Matching)
- **平衡条件 (Formula 17)**: 寻找 $\Omega$ 使得 $Q_m(\Omega, v) = Q(\Omega, V)$。此时的转速即为实际运行转速。

## 📊 图表说明

- **Torque**: 展示电机输出扭矩与螺旋桨负载扭矩的交点（平衡点）。
- **Thrust**: 随转速变化的推力输出。
- **Efficiency**: 电机转换效率（电能转机械能）。
- **Power**: 同时绘制 **P Elec (输入电功率, F4)**、**P Shaft (电机轴输出功率, F3)** 与 **P Prop (螺旋桨吸收功率)**，展示能量损耗。
- **Prop RPM**: 螺旋桨特性随转速的变化（推力、扭矩、螺旋桨效率）。
- **Prop Lambda**: 螺旋桨特性随进气比 $\lambda$ 的变化，展示螺旋桨在不同飞行速度下的性能包线。

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

---
*Developed with ❤️ for the FPV Community.*
