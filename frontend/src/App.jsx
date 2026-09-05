import { useState } from "react";
import "./App.css";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import AddFood from "./pages/AddFood";
import FoodInventory from "./pages/FoodInventory";
import Profile from "./pages/Profile";


function App() {

  // ==========================================================
  // PAGE STATE
  // ==========================================================

  const [page, setPage] = useState(() => {

    const token =
      localStorage.getItem("access_token");

    return token
      ? "dashboard"
      : "login";

  });


  // ==========================================================
  // LOGIN SUCCESS
  // ==========================================================

  const handleLoginSuccess = () => {

    setPage("dashboard");

  };


  // ==========================================================
  // LOGOUT
  // ==========================================================

  const handleLogout = () => {

    localStorage.removeItem(
      "access_token"
    );

    setPage("login");

  };


  // ==========================================================
  // LOGIN PAGE
  // ==========================================================

  if (page === "login") {

    return (

      <Login
        onLoginSuccess={
          handleLoginSuccess
        }

        onRegisterPage={() =>
          setPage("register")
        }
      />

    );

  }


  // ==========================================================
  // REGISTER PAGE
  // ==========================================================

  if (page === "register") {

    return (

      <Register
        onLoginPage={() =>
          setPage("login")
        }
      />

    );

  }


  // ==========================================================
  // DASHBOARD
  // ==========================================================

  if (page === "dashboard") {

    return (

      <Dashboard

        onLogout={
          handleLogout
        }

        onAddFood={() =>
          setPage("add-food")
        }

        onInventory={() =>
          setPage("inventory")
        }

        onProfile={() =>
          setPage("profile")
        }

      />

    );

  }


  // ==========================================================
  // ADD FOOD
  // ==========================================================

  if (page === "add-food") {

    return (

      <AddFood

        onBack={() =>
          setPage("dashboard")
        }

        onSuccess={() =>
          setPage("inventory")
        }

      />

    );

  }


  // ==========================================================
  // FOOD INVENTORY
  // ==========================================================

  if (page === "inventory") {

    return (

      <FoodInventory

        onBack={() =>
          setPage("dashboard")
        }

        onAddFood={() =>
          setPage("add-food")
        }

      />

    );

  }


  // ==========================================================
  // PROFILE
  // ==========================================================

  if (page === "profile") {

    return (

      <Profile

        onBack={() =>
          setPage("dashboard")
        }

        onLogout={
          handleLogout
        }

      />

    );

  }


  // ==========================================================
  // FALLBACK
  // ==========================================================

  return null;

}


export default App;