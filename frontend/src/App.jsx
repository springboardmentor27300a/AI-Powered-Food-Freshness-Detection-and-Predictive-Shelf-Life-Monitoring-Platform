import { useState } from "react";
import "./App.css";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import AddFood from "./pages/AddFood";
import FoodInventory from "./pages/FoodInventory";

function App() {
  const [page, setPage] = useState(() => {
    const token = localStorage.getItem("access_token");

    return token ? "dashboard" : "login";
  });

  const handleLoginSuccess = () => {
    setPage("dashboard");
  };

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    setPage("login");
  };

  if (page === "login") {
    return (
      <Login
        onLoginSuccess={handleLoginSuccess}
        onRegisterPage={() => setPage("register")}
      />
    );
  }

  if (page === "register") {
    return (
      <Register
        onLoginPage={() => setPage("login")}
      />
    );
  }

  if (page === "dashboard") {
    return (
      <Dashboard
        onLogout={handleLogout}
        onAddFood={() => setPage("add-food")}
        onInventory={() => setPage("inventory")}
      />
    );
  }

  if (page === "add-food") {
    return (
      <AddFood
        onBack={() => setPage("dashboard")}
        onSuccess={() => setPage("inventory")}
      />
    );
  }

  if (page === "inventory") {
    return (
      <FoodInventory
        onBack={() => setPage("dashboard")}
        onAddFood={() => setPage("add-food")}
      />
    );
  }

  return null;
}

export default App;