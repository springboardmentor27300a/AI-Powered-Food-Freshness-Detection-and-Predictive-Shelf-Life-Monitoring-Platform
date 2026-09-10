import { useState } from "react";
import "./App.css";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import AddFood from "./pages/AddFood";
import FoodInventory from "./pages/FoodInventory";
import Profile from "./pages/Profile";
import FoodReport from "./pages/FoodReport";


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
  // SELECTED FOOD FOR REPORT
  // ==========================================================

  const [selectedFood, setSelectedFood] =
    useState(null);


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

    setSelectedFood(null);

    setPage("login");

  };


  // ==========================================================
  // OPEN FOOD REPORT
  // ==========================================================

  const handleViewReport = (food) => {

    setSelectedFood(food);

    setPage("food-report");

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

        onViewReport={
          handleViewReport
        }

      />

    );

  }


  // ==========================================================
  // FOOD REPORT
  // ==========================================================

  if (page === "food-report") {

    return (

      <FoodReport

        food={selectedFood}

        onBack={() => {

          setSelectedFood(null);

          setPage("inventory");

        }}

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