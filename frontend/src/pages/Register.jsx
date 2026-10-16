import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import FormInput from "../components/FormInput.jsx";

const ROLES = [
  { value: "consumer", label: "Consumer" },
  { value: "retail_manager", label: "Retail Manager" },
  { value: "warehouse_operator", label: "Warehouse Operator" },
  { value: "food_quality_inspector", label: "Food Quality Inspector" },
  { value: "administrator", label: "Administrator" },
];

const initialForm = {
  full_name: "",
  email: "",
  phone: "",
  password: "",
  confirm_password: "",
  role: "consumer",
};

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const validate = () => {
    const next = {};

    if (!form.full_name.trim() || form.full_name.trim().length < 2) {
      next.full_name = "Please enter your full name";
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email)) {
      next.email = "Enter a valid email address";
    }

    const phoneRegex = /^\+?[0-9\s\-()]{7,20}$/;
    if (!phoneRegex.test(form.phone)) {
      next.phone = "Enter a valid phone number";
    }

    if (form.password.length < 8) {
      next.password = "Password must be at least 8 characters";
    } else if (!/[A-Za-z]/.test(form.password) || !/[0-9]/.test(form.password)) {
      next.password = "Password must contain letters and numbers";
    }

    if (form.confirm_password !== form.password) {
      next.confirm_password = "Passwords do not match";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setApiError("");
    setSuccessMsg("");

    if (!validate()) return;

    setSubmitting(true);
    try {
      await register(form);
      setSuccessMsg("Account created successfully! Redirecting to login...");
      setTimeout(() => navigate("/login"), 1500);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      if (typeof detail === "string") {
        setApiError(detail);
      } else if (Array.isArray(detail)) {
        // FastAPI/Pydantic validation error array
        setApiError(detail.map((d) => d.msg).join(", "));
      } else {
        setApiError("Something went wrong while creating your account. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 via-white to-brand-100 px-4 py-10">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-6">
          <div className="mx-auto mb-3 h-12 w-12 rounded-xl bg-brand-500 flex items-center justify-center text-white text-2xl">
            🥦
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Create your account</h1>
          <p className="text-sm text-gray-500 mt-1">
            Join the Food Freshness Monitoring Platform
          </p>
        </div>

        {apiError && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
            {apiError}
          </div>
        )}
        {successMsg && (
          <div className="mb-4 rounded-lg bg-brand-50 border border-brand-200 text-brand-700 text-sm px-4 py-3">
            {successMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <FormInput
            label="Full Name"
            name="full_name"
            value={form.full_name}
            onChange={handleChange}
            error={errors.full_name}
            placeholder="Jane Doe"
            autoComplete="name"
          />

          <FormInput
            label="Email"
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            error={errors.email}
            placeholder="jane@example.com"
            autoComplete="email"
          />

          <FormInput
            label="Phone Number"
            type="tel"
            name="phone"
            value={form.phone}
            onChange={handleChange}
            error={errors.phone}
            placeholder="+1 202 555 0176"
            autoComplete="tel"
          />

          <FormInput
            label="Password"
            type={showPassword ? "text" : "password"}
            name="password"
            value={form.password}
            onChange={handleChange}
            error={errors.password}
            placeholder="At least 8 characters"
            autoComplete="new-password"
            rightElement={
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="text-xs font-medium text-brand-600 hover:text-brand-700"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            }
          />

          <FormInput
            label="Confirm Password"
            type={showPassword ? "text" : "password"}
            name="confirm_password"
            value={form.confirm_password}
            onChange={handleChange}
            error={errors.confirm_password}
            placeholder="Re-enter your password"
            autoComplete="new-password"
          />

          <div className="mb-6">
            <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
              Role
            </label>
            <select
              id="role"
              name="role"
              value={form.role}
              onChange={handleChange}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-transparent bg-white"
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg transition shadow-sm"
          >
            {submitting ? "Creating account..." : "Register"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Already have an account?{" "}
          <Link to="/login" className="text-brand-600 font-medium hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
