import { useState } from "react";
import "./App.css";

import Login from "./pages/Login";
import Register from "./pages/Register";

import Dashboard from "./pages/Dashboard";

import RetailDashboard from "./pages/RetailDashboard";
import WarehouseDashboard from "./pages/WarehouseDashboard";
import InspectorDashboard from "./pages/InspectorDashboard";
import AdminDashboard from "./pages/AdminDashboard";

import AddFood from "./pages/AddFood";
import FoodInventory from "./pages/FoodInventory";
import Profile from "./pages/Profile";
import FoodReport from "./pages/FoodReport";
import Reports from "./pages/Reports";


function App() {

  // ==========================================================
  // PAGE STATE
  // ==========================================================

  const [page, setPage] = useState(() => {

    const token =
      localStorage.getItem(
        "access_token"
      );

    return token
      ? "dashboard"
      : "login";

  });


  // ==========================================================
  // SELECTED FOOD
  // ==========================================================

  const [selectedFood, setSelectedFood] =
    useState(null);


  // ==========================================================
  // LOGIN SUCCESS
  // ==========================================================

  const handleLoginSuccess = (
    role
  ) => {

    const userRole =
      role ||
      localStorage.getItem(
        "user_role"
      ) ||
      "consumer";


    localStorage.setItem(
      "user_role",
      userRole
    );


    setPage(
      "dashboard"
    );

  };


  // ==========================================================
  // LOGOUT
  // ==========================================================

  const handleLogout = () => {

    localStorage.removeItem(
      "access_token"
    );

    localStorage.removeItem(
      "current_user"
    );

    localStorage.removeItem(
      "user_role"
    );

    setSelectedFood(null);

    setPage("login");

  };


  // ==========================================================
  // FOOD REPORT
  // ==========================================================

  const handleViewReport = (
    food
  ) => {

    setSelectedFood(food);

    setPage(
      "food-report"
    );

  };


  // ==========================================================
  // LOGIN
  // ==========================================================

  if (page === "login") {

    return (

      <Login

        onLoginSuccess={
          handleLoginSuccess
        }

        onRegisterPage={() =>
          setPage(
            "register"
          )
        }

      />

    );

  }


  // ==========================================================
  // REGISTER
  // ==========================================================

  if (page === "register") {

    return (

      <Register

        onLoginPage={() =>
          setPage(
            "login"
          )
        }

      />

    );

  }


  // ==========================================================
  // CURRENT ROLE
  // ==========================================================

  const role =
    (
      localStorage.getItem(
        "user_role"
      ) || "consumer"
    )
      .toLowerCase();


  // ==========================================================
  // CONSUMER DASHBOARD
  // ==========================================================

  if (
    page === "dashboard" &&
    role === "consumer"
  ) {

    return (

      <Dashboard

        onLogout={
          handleLogout
        }

        onAddFood={() =>
          setPage(
            "add-food"
          )
        }

        onInventory={() =>
          setPage(
            "inventory"
          )
        }

        onProfile={() =>
          setPage(
            "profile"
          )
        }

        onReports={() =>
          setPage(
            "reports"
          )
        }

      />

    );

  }


  // ==========================================================
  // RETAIL MANAGER DASHBOARD
  // ==========================================================

  if (
    page === "dashboard" &&
    role === "retail_manager"
  ) {

    return (

      <RetailDashboard

        onLogout={
          handleLogout
        }

        onProfile={() =>
          setPage(
            "profile"
          )
        }

        onInventory={() =>
          setPage(
            "inventory"
          )
        }

        onReports={() =>
          setPage(
            "reports"
          )
        }

      />

    );

  }


  // ==========================================================
  // WAREHOUSE OPERATOR DASHBOARD
  // ==========================================================

  if (
    page === "dashboard" &&
    role === "warehouse_operator"
  ) {

    return (

      <WarehouseDashboard

        onLogout={
          handleLogout
        }

        onProfile={() =>
          setPage(
            "profile"
          )
        }

        onInventory={() =>
          setPage(
            "inventory"
          )
        }

        onReports={() =>
          setPage(
            "reports"
          )
        }

      />

    );

  }


  // ==========================================================
  // FOOD QUALITY INSPECTOR
  // ==========================================================

  if (
    page === "dashboard" &&
    role ===
      "food_quality_inspector"
  ) {

    return (

      <InspectorDashboard

        onLogout={
          handleLogout
        }

        onProfile={() =>
          setPage(
            "profile"
          )
        }

        onInventory={() =>
          setPage(
            "inventory"
          )
        }

        onReports={() =>
          setPage(
            "reports"
          )
        }

      />

    );

  }


  // ==========================================================
  // ADMINISTRATOR
  // ==========================================================

  if (
    page === "dashboard" &&
    role === "administrator"
  ) {

    return (

      <AdminDashboard

        onLogout={
          handleLogout
        }

        onProfile={() =>
          setPage(
            "profile"
          )
        }

        onReports={() =>
          setPage(
            "reports"
          )
        }

      />

    );

  }


  // ==========================================================
  // ADD FOOD
  // ==========================================================

  if (
    page === "add-food"
  ) {

    return (

      <AddFood

        onBack={() =>
          setPage(
            "dashboard"
          )
        }

        onSuccess={() =>
          setPage(
            "inventory"
          )
        }

      />

    );

  }


  // ==========================================================
  // INVENTORY
  // ==========================================================

  if (
    page === "inventory"
  ) {

    return (

      <FoodInventory

        onBack={() =>
          setPage(
            "dashboard"
          )
        }

        onAddFood={() =>
          setPage(
            "add-food"
          )
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

  if (
    page === "food-report"
  ) {

    return (

      <FoodReport

        food={
          selectedFood
        }

        onBack={() => {

          setSelectedFood(
            null
          );

          setPage(
            "inventory"
          );

        }}

      />

    );

  }


  // ==========================================================
  // REPORTS
  // ==========================================================

  if (
    page === "reports"
  ) {

    return (

      <Reports

        onBack={() =>
          setPage(
            "dashboard"
          )
        }

      />

    );

  }


  // ==========================================================
  // PROFILE
  // ==========================================================

  if (
    page === "profile"
  ) {

    return (

      <Profile

        onBack={() =>
          setPage(
            "dashboard"
          )
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