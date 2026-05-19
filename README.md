# BharatSupply 🚢📦

##Link: https://bharatsupply.onrender.com
### **AI-Driven Port-to-Plant Logistics Optimization Engine**

BharatSupply is a state-of-the-art, end-to-end logistics orchestration platform designed to optimize the supply chain from maritime ports to industrial plants. By integrating **Gradient Boosted Machine Learning** with **Mixed Integer Linear Programming (MILP)**, the system provides predictive insights and optimal scheduling to eliminate bottlenecks in vessel-to-rake coal transportation.

---

## 🚀 Core Features

- **Predictive Delay Modeling**: Uses a custom-built XGBoost-style engine to forecast vessel and rake arrivals based on weather, congestion, and historical data.
- **MILP Optimization**: Solves complex logistics constraints to minimize costs and maximize throughput using Linear Programming.
- **What-If Simulation**: A sandbox environment to simulate disruptions (e.g., port closures, weather events) and evaluate their impact on the supply chain.
- **Real-Time Inventory Control**: Dynamic tracking of plant coal stocks with automated reorder alerts and replenishment planning.
- **ML Studio**: A dedicated workspace for training, evaluating, and deploying delay prediction models directly in the browser.

---

## 🏗️ System Architecture

The project follows a modern **Full-Stack JavaScript Architecture** with a decoupled engines layer for high-performance computation.

### **Frontend Layer**
- **Single Page Application (SPA)**: Built with Vanilla JS and ES Modules for modularity without framework overhead.
- **Rich Aesthetics**: Implements a premium dark-mode interface with glassmorphism, fluid animations, and a responsive layout.
- **Visualization**: Interactive dashboards powered by **Chart.js** for real-time KPI monitoring.

### **Backend Layer**
- **Node.js & Express**: A robust REST API managing authentication, data persistence, and file processing.
- **MongoDB (Mongoose)**: Document-based storage for vessel plans, inventory records, and user profiles.
- **Security**: JWT-based stateless authentication and bcryptjs for secure credential hashing.

### **Intelligence Layer (Engines)**
- **Prediction Engine**: A custom implementation of Gradient Boosted Decision Trees (GBDT) for high-accuracy regression.
- **Optimization Engine**: Integration with `javascript-lp-solver` to handle supply chain constraints and cost-effective allocation.

---

## 🧠 Machine Learning & Algorithms

### **Gradient Boosting (XGBoost Logic)**
The system features a proprietary **DelayPredictor** implementation that uses an ensemble of decision trees to predict arrival delays.
- **Algorithm**: Gradient Boosting Regressor with MSE (Mean Squared Error) Loss.
- **Features**: 
  - `Origin Distance`: Nautical miles from the port of origin.
  - `Seasonality Index`: Impact of weather patterns (Monsoon, Winter, etc.).
  - `Vessel Age`: Reliability factors based on vessel vintage.
  - `Port Congestion`: Real-time traffic density at destination ports.
- **Optimization**: Uses `learning_rate` (Eta) and `colsample_bytree` to prevent overfitting and improve generalization.

### **Supply Chain Optimization**
- **Model**: Mixed Integer Linear Programming (MILP).
- **Objective**: Minimize `Total Cost = (Transport Cost + Delay Penalties + Inventory Holding Costs)`.
- **Constraints**: Throughput limits, rake availability, plant demand, and storage capacity.

---

## 🛠️ Tech Stack

| Category | Tools & Technologies |
| :--- | :--- |
| **Frontend** | HTML5, CSS3 (Vanilla), JavaScript (ES6+), Chart.js |
| **Backend** | Node.js, Express.js, Passport.js |
| **Database** | MongoDB, Mongoose |
| **ML/Math** | Custom GBDT Engine, `javascript-lp-solver` |
| **DevOps** | Multer (File Uploads), Dotenv (Config), Git |

---

## 📁 Project Structure

```text
├── backend/            # Express server, API routes, and DB models
├── css/                # Modular styling (Dashboard, ML-Studio, etc.)
├── js/
│   ├── app.js          # Main application entry point
│   ├── ui/             # Component-based UI controllers
│   ├── engines/        # Prediction, Optimization, and Simulation logic
│   ├── data/           # Constants and CSV data sources
│   └── utils/          # Helper functions and API wrappers
├── ml/                 # Python scripts for model prototyping (Scikit-learn)
├── uploads/            # Storage for bulk data processing
└── index.html          # Main HTML5 entry point
```

---

## ⚙️ Installation & Setup

1. **Clone the Repository**
   ```bash
   git clone https://github.com/Rohithaddela/tbp-logistics.git
   cd tbp-logistics
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment**
   Create a `.env` file in the root directory:
   ```env
   PORT=5000
   MONGO_URI=your_mongodb_connection_string
   JWT_SECRET=your_super_secret_key
   ```

4. **Run the Application**
   ```bash
   npm start
   ```
   Access the dashboard at `http://localhost:5000`.

---

## 🛡️ License
This project is licensed under the ISC License. 

---
Developed as part of the **Theme Based Project (TBP) 2026** for optimized logistics and supply chain intelligence.

# AI-ENABLED LOGISTICS OPTIMIZER FOR COST-OPTIMAL VESSEL SCHEDULING AND PORT-PLANT LINKAGE IN STEEL SUPPLY CHAIN

BharatSupply is an AI-powered Port-to-Plant logistics and supply chain management system designed to optimize the transportation of raw materials from ports to industrial plants.
