# 🌐 SpotWise  
*Hyper-local service connection within 5km radius*  

![SpotWise Banner](https://img.shields.io/badge/SpotWise-Live-leafgreen?style=for-the-badge&logo=vercel&logoColor=blue)   
---
![HTML5](https://img.shields.io/badge/HTML5-Frontend-yellow?style=for-the-badge&logo=html5&logoColor=orange)   ![CSS3](https://img.shields.io/badge/CSS3-Frontend-yellow?style=for-the-badge&logo=css3&logoColor=blue)  ![Bootstrap](https://img.shields.io/badge/Bootstrap-5-blueviolet?style=for-the-badge&logo=bootstrap&logoColor=violet) ![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-yellow?style=for-the-badge&logo=javascript&logoColor=yellow)    
![Node.js](https://img.shields.io/badge/Node.js-Backend-339933?style=for-the-badge&logo=node.js&logoColor=green)  ![Express.js](https://img.shields.io/badge/Express.js-Backend-green?style=for-the-badge&logo=express&logoColor=green)  
![MongoDB](https://img.shields.io/badge/MongoDB-Database-47A248?style=for-the-badge&logo=mongodb&logoColor=green)  
![JWT](https://img.shields.io/badge/JWT-Authentication-blueviolet?style=for-the-badge&logo=jsonwebtokens&logoColor=pink)  
![Google Maps API](https://img.shields.io/badge/Google%20Maps%20API-Geolocation-red?style=for-the-badge&logo=googlemaps&logoColor=blue)  

---

## 📖 Description  
**SpotWise** is a hyper-local web platform that connects **service seekers** with **local service providers** (plumbers, electricians, carpenters, cleaners, etc.) within a **5km radius**.  
It ensures **fast, secure, and reliable** service booking through:  
- Geolocation-based provider matching  
- PIN-verified service completion  
- Real-time notifications  
- Scalable and mobile-friendly design  

---

## ❗ Problem Statement  
Traditional service platforms face multiple challenges:  
- ❌ **Poor Geolocation Accuracy** – Manual address entry leads to mismatched providers.  
- ❌ **Unsecured Transactions** – No proper verification, leading to disputes and fraud.  
- ❌ **Scalability Issues** – Existing systems fail under high traffic loads.  
- ❌ **Fragmented User Experience** – Non-responsive designs and lack of request history tracking.  

**SpotWise solves this** with accurate 5km geofencing, real-time alerts, secure authentication, and a unified interface.  

---

## ⚙️ Tech Stack  

**Frontend**  
- ![HTML5](https://img.shields.io/badge/HTML5-Frontend-white?style=for-the-badge&logo=html5&logoColor=orange)  
- ![CSS3](https://img.shields.io/badge/CSS3-Frontend-white?style=for-the-badge&logo=css3&logoColor=blue)  
- ![Bootstrap](https://img.shields.io/badge/Bootstrap-5-blueviolet?style=for-the-badge&logo=bootstrap&logoColor=violet)  
- ![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-yellow?style=for-the-badge&logo=javascript&logoColor=yellow)  

**Backend**  
- ![Node.js](https://img.shields.io/badge/Node.js-Backend-339933?style=for-the-badge&logo=node.js&logoColor=green)  
- ![Express.js](https://img.shields.io/badge/Express.js-Backend-green?style=for-the-badge&logo=express&logoColor=green)  
- ![MongoDB](https://img.shields.io/badge/MongoDB-Database-47A248?style=for-the-badge&logo=mongodb&logoColor=green)  
- ![JWT](https://img.shields.io/badge/JWT-Authentication-blueviolet?style=for-the-badge&logo=jsonwebtokens&logoColor=pink)  
- ![Google Maps API](https://img.shields.io/badge/Google%20Maps%20API-Geolocation-red?style=for-the-badge&logo=googlemaps&logoColor=blue)  

---

## ✨ Features  
- 📍 **Nearby Provider Matching** – Find providers in a **5km radius** with Google Maps API  
- 🔐 **Secure Authentication** – Role-based access via **JWT tokens**  
- ⚡ **Real-Time Notifications** – Service alerts using **WebSockets**  
- 🔑 **PIN Verification** – Unique **6-digit code** for service completion security  
- 📱 **Responsive UI** – Works smoothly on **mobile & desktop** with Bootstrap  

---

## ⚙️ Installation & Setup  

### **1. Clone the Repository**  
```bash
git clone https://github.com/your-username/spotwise.git
cd spotwise
```

---

### **2. Backend Setup**  
Navigate to the `backend` folder:  
```bash
cd backend
```
Install dependencies:  
```bash
npm install
```
Create a `.env` file and configure:  
```
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_secret_key
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```
Run the backend:  
```bash
npm start
```
The backend will run on:  
```
http://localhost:5000
```

---

### **3. Frontend Setup**  
Navigate to the `frontend` folder:  
```bash
cd ../frontend
```
Open `index.html` in your browser (or use a live server in VS Code).  

---

## ✅ Usage Instructions  
- **For Service Seekers:**  
  - Register and log in.  
  - Post a service request.  
- **For Service Providers:**  
  - Log in to view available requests.  
  - Accept and complete services using the verification PIN.  

---
# 📷 Screenshots

## 📷 Screenshots  

<p align="center">
  <img src="./screenshots/login-signup.png" alt="Login / Sign-Up" width="250" />
  <img src="./screenshots/create-request.png" alt="Create Request (Seeker)" width="250" />
  <img src="./screenshots/available-requests.png" alt="Available Requests (Provider)" width="250" />
</p>

<p align="center">
  <img src="./screenshots/active-requests.png" alt="Active Requests with PIN Verification" width="250" />
  <img src="./screenshots/service-history.png" alt="Service History & Dashboard" width="250" />
  <img src="./screenshots/homepage.png" alt="Homepage / About Us" width="250" />
</p>

---

## 🚀 Future Enhancements  
- Integrate **real-time chat** between seeker and provider  
- Add **payment gateway** for transactions  
- Improve geolocation accuracy with **advanced Google Maps features**  
- Implement **AI-based provider ranking**  

## 📜 License  

This project is licensed under the **MIT License**.  
---

## 👥 Contributors  

- **[Dhanushkumar M](https://github.com/dhanushkumarms)**  
- **[Jeyanth V P](https://github.com/Jeyanth2005)**  
- **[Jothiswarar S](https://github.com/jothiswarar)**  
- **[Santhosh G](https://github.com/ITZsanthosh369)**  
