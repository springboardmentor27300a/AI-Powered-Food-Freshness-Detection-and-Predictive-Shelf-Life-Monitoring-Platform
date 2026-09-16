// ============================================================
// FOOD FRESHNESS MONITORING PLATFORM
// Frontend API Service
// ============================================================

const API_URL =
  "http://127.0.0.1:8000";


// ============================================================
// COMMON REQUEST FUNCTION
// ============================================================

async function request(
  endpoint,
  options = {}
) {

  const token =
    localStorage.getItem(
      "access_token"
    );

  const headers = {
    Accept:
      "application/json",

    ...(options.body
      ? {
          "Content-Type":
            "application/json",
        }
      : {}),

    ...(options.headers || {}),
  };


  if (
    token &&
    !headers.Authorization
  ) {

    headers.Authorization =
      `Bearer ${token}`;
  }


  let response;


  try {

    response = await fetch(
      `${API_URL}${endpoint}`,
      {
        ...options,
        headers,
      }
    );

  } catch (error) {

    throw new Error(
      "Cannot connect to backend. Please make sure FastAPI is running.",
      {
        cause: error,
      }
    );
  }


  const data =
    await response
      .json()
      .catch(() => null);


  // ==========================================================
  // UNAUTHORIZED
  // ==========================================================

  if (
    response.status === 401
  ) {

    localStorage.removeItem(
      "access_token"
    );

    localStorage.removeItem(
      "current_user"
    );

    localStorage.removeItem(
      "user_role"
    );

    throw new Error(
      data?.detail ||
        "Session expired. Please login again."
    );
  }


  // ==========================================================
  // OTHER ERRORS
  // ==========================================================

  if (!response.ok) {

    let message =
      "Something went wrong.";


    if (
      typeof data?.detail ===
      "string"
    ) {

      message =
        data.detail;

    } else if (
      Array.isArray(
        data?.detail
      )
    ) {

      message =
        data.detail
          .map(
            (item) =>
              item.msg
          )
          .join(", ");
    }


    throw new Error(
      message
    );
  }


  return data;
}


// ============================================================
// REGISTER
// ============================================================

export async function registerUser(
  name,
  email,
  password,
  role = "consumer"
) {

  return request(
    "/auth/register",
    {
      method: "POST",

      body: JSON.stringify({
        name,
        email,
        password,
        role,
      }),
    }
  );
}


// ============================================================
// LOGIN
// ============================================================

export async function loginUser(
  email,
  password
) {

  const data =
    await request(
      "/auth/login",
      {
        method: "POST",

        body: JSON.stringify({
          email,
          password,
        }),
      }
    );


  // ==========================================================
  // SAVE ACCESS TOKEN
  // ==========================================================

  if (
    data?.access_token
  ) {

    localStorage.setItem(
      "access_token",
      data.access_token
    );
  }


  // ==========================================================
  // SAVE ROLE
  // ==========================================================

  if (data?.role) {

    localStorage.setItem(
      "user_role",
      data.role
    );
  }


  return data;
}


// ============================================================
// LOGOUT
// ============================================================

export function logoutUser() {

  localStorage.removeItem(
    "access_token"
  );

  localStorage.removeItem(
    "current_user"
  );

  localStorage.removeItem(
    "user_role"
  );
}


// ============================================================
// CURRENT USER
// ============================================================

export async function getCurrentUser() {

  const user =
    await request(
      "/auth/me",
      {
        method: "GET",
      }
    );


  if (user) {

    localStorage.setItem(
      "current_user",
      JSON.stringify(user)
    );


    if (user.role) {

      localStorage.setItem(
        "user_role",
        user.role
      );
    }
  }


  return user;
}


// ============================================================
// ADD FOOD
// ============================================================

export async function addFood(
  food_name,
  category = "Other",
  image_path = null,
  manufacturing_date = null,
  expiry_date = null,
  storage_condition = "Refrigerator",
  freshness_status = "Pending",
  freshness_score = null
) {

  if (
    !food_name ||
    !food_name.trim()
  ) {

    throw new Error(
      "Please enter a food name."
    );
  }


  return request(
    "/foods",
    {
      method: "POST",

      body: JSON.stringify({

        food_name:
          food_name.trim(),

        category,

        image_path,

        manufacturing_date,

        expiry_date,

        storage_condition,

        freshness_status,

        freshness_score,

      }),
    }
  );
}


// ============================================================
// GET FOODS
// ============================================================

export async function getFoods() {

  return request(
    "/foods",
    {
      method: "GET",
    }
  );
}


// ============================================================
// GET SINGLE FOOD
// ============================================================

export async function getFood(
  foodId
) {

  if (!foodId) {

    throw new Error(
      "Invalid food ID."
    );
  }


  return request(
    `/foods/${foodId}`,
    {
      method: "GET",
    }
  );
}


// ============================================================
// DELETE FOOD
// ============================================================

export async function deleteFood(
  foodId
) {

  if (!foodId) {

    throw new Error(
      "Invalid food ID."
    );
  }


  return request(
    `/foods/${foodId}`,
    {
      method: "DELETE",
    }
  );
}


// ============================================================
// FOOD IMAGE UPLOAD
// ============================================================

export async function uploadFoodImage(
  file
) {

  if (!file) {

    throw new Error(
      "Please select a food image."
    );
  }


  const formData =
    new FormData();

  formData.append(
    "file",
    file
  );


  const token =
    localStorage.getItem(
      "access_token"
    );


  const headers = {
    Accept:
      "application/json",
  };


  if (token) {

    headers.Authorization =
      `Bearer ${token}`;
  }


  let response;


  try {

    response = await fetch(
      `${API_URL}/upload/food-image`,
      {
        method: "POST",
        headers,
        body: formData,
      }
    );

  } catch (error) {

    throw new Error(
      "Cannot connect to backend. Please make sure FastAPI is running.",
      {
        cause: error,
      }
    );
  }


  const data =
    await response
      .json()
      .catch(() => null);


  if (
    response.status === 401
  ) {

    localStorage.removeItem(
      "access_token"
    );

    localStorage.removeItem(
      "current_user"
    );

    localStorage.removeItem(
      "user_role"
    );

    throw new Error(
      data?.detail ||
        "Session expired. Please login again."
    );
  }


  if (!response.ok) {

    let message =
      "Image upload failed.";


    if (
      typeof data?.detail ===
      "string"
    ) {

      message =
        data.detail;

    } else if (
      Array.isArray(
        data?.detail
      )
    ) {

      message =
        data.detail
          .map(
            (item) =>
              item.msg
          )
          .join(", ");
    }


    throw new Error(
      message
    );
  }


  return data;
}


// ============================================================
// AI FRESHNESS PREDICTION
// ============================================================

export async function predictFoodFreshness(
  food_name,
  image_path
) {

  if (
    !food_name ||
    !food_name.trim()
  ) {

    throw new Error(
      "Food name is required for prediction."
    );
  }


  if (!image_path) {

    throw new Error(
      "Food image is required for prediction."
    );
  }


  return request(
    "/prediction/",
    {
      method: "POST",

      body: JSON.stringify({

        food_name:
          food_name.trim(),

        image_path,

      }),
    }
  );
}


// ============================================================
// PREDICTION HEALTH
// ============================================================

export async function checkPredictionHealth() {

  return request(
    "/prediction/health",
    {
      method: "GET",
    }
  );
}


// ============================================================
// BACKEND HEALTH
// ============================================================

export async function checkBackendHealth() {

  return request(
    "/",
    {
      method: "GET",
    }
  );
}


// ============================================================
// FOOD HEALTH
// ============================================================

export async function checkFoodHealth() {

  return request(
    "/foods/health",
    {
      method: "GET",
    }
  );
}