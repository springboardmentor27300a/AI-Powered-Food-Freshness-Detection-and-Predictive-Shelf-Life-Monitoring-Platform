


  const API_URL =
  import.meta.env.VITE_API_URL ||
  "https://food-freshness-monitoring-platform-bzh9.onrender.com";

// ============================================================
// COMMON REQUEST HELPER
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
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization =
      `Bearer ${token}`;
  }

  try {
    const response =
      await fetch(
        `${API_URL}${endpoint}`,
        {
          ...options,
          headers,
        }
      );

    let data = null;

    try {
      data =
        await response.json();
    } catch {
      data = null;
    }

    if (
      response.status === 401
    ) {
      localStorage.removeItem(
        "access_token"
      );

      localStorage.removeItem(
        "user"
      );

      throw new Error(
        "Session expired. Please login again."
      );
    }

    if (!response.ok) {
      let message =
        "Something went wrong.";

      if (data?.detail) {
        if (
          Array.isArray(
            data.detail
          )
        ) {
          message =
            data.detail
              .map(
                (item) =>
                  item.msg ||
                  "Validation error"
              )
              .join(", ");
        } else {
          message =
            data.detail;
        }
      } else if (
        data?.message
      ) {
        message =
          data.message;
      }

      throw new Error(
        message
      );
    }

    return data;

  } catch (error) {

    if (
      error instanceof TypeError &&
      error.message
        .toLowerCase()
        .includes("fetch")
    ) {
      throw new Error(
        "Cannot connect to backend. Please make sure FastAPI is running."
      );
    }

    throw error;
  }
}


// ============================================================
// AUTHENTICATION
// ============================================================

export async function registerUser(
  userData
) {
  return request(
    "/auth/register",
    {
      method: "POST",
      body: JSON.stringify(
        userData
      ),
    }
  );
}


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

  if (
    data?.access_token
  ) {
    localStorage.setItem(
      "access_token",
      data.access_token
    );
  }

  if (data?.user) {
    localStorage.setItem(
      "user",
      JSON.stringify(
        data.user
      )
    );
  }

  return data;
}


export async function logoutUser() {
  localStorage.removeItem(
    "access_token"
  );

  localStorage.removeItem(
    "user"
  );
}


export async function getCurrentUser() {
  return request(
    "/auth/me",
    {
      method: "GET",
    }
  );
}


// ============================================================
// FOOD MANAGEMENT
// ============================================================

export async function addFood(
  food_name,
  category = "Other",
  image_path = null,
  manufacturing_date = null,
  expiry_date = null,
  storage_condition =
    "Refrigerator",
  freshness_status =
    "Pending",
  freshness_score = null,

  // ==========================================================
  // STORAGE INTELLIGENCE INPUTS
  // ==========================================================

  storage_temperature =
    null,
  storage_humidity = null,
  packaging_type = null,
  storage_duration = null,
  air_circulation = null,
  light_exposure = null,

  // ==========================================================
  // MILESTONE 3 - CALCULATED OUTPUTS
  // ==========================================================

  remaining_shelf_life = null,
  shelf_life_confidence = null,
  shelf_life_risk = null,
  storage_compliance_score =
    null,
  overall_health_score = null
) {

  if (
    !food_name ||
    !food_name.trim()
  ) {
    throw new Error(
      "Food name is required."
    );
  }

  return request(
    "/foods/",
    {
      method: "POST",

      body: JSON.stringify({

        // ------------------------------------------------------
        // Existing fields
        // ------------------------------------------------------

        food_name:
          food_name.trim(),

        category,

        image_path,

        manufacturing_date,

        expiry_date,

        storage_condition,

        freshness_status,

        freshness_score,

        // ------------------------------------------------------
        // Storage intelligence fields
        // ------------------------------------------------------

        storage_temperature,

        storage_humidity,

        packaging_type,

        storage_duration,

        air_circulation,

        light_exposure,

        // ------------------------------------------------------
        // Milestone 3 calculated outputs
        // ------------------------------------------------------

        remaining_shelf_life,

        shelf_life_confidence,

        shelf_life_risk,

        storage_compliance_score,

        overall_health_score,
      }),
    }
  );
}


export async function getFoods() {
  return request(
    "/foods/",
    {
      method: "GET",
    }
  );
}


export async function getFood(
  foodId
) {

  if (!foodId) {
    throw new Error(
      "Food ID is required."
    );
  }

  return request(
    `/foods/${foodId}`,
    {
      method: "GET",
    }
  );
}


export async function deleteFood(
  foodId
) {

  if (!foodId) {
    throw new Error(
      "Food ID is required."
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
      "Food image is required."
    );
  }

  const token =
    localStorage.getItem(
      "access_token"
    );

  const formData =
    new FormData();

  formData.append(
    "file",
    file
  );

  const headers = {};

  if (token) {
    headers.Authorization =
      `Bearer ${token}`;
  }

  try {

    const response =
      await fetch(
        `${API_URL}/upload/food-image`,
        {
          method: "POST",
          headers,
          body: formData,
        }
      );

    let data = null;

    try {
      data =
        await response.json();
    } catch {
      data = null;
    }

    if (
      response.status === 401
    ) {
      localStorage.removeItem(
        "access_token"
      );

      localStorage.removeItem(
        "user"
      );

      throw new Error(
        "Session expired. Please login again."
      );
    }

    if (!response.ok) {

      let message =
        "Image upload failed.";

      if (data?.detail) {

        message =
          Array.isArray(
            data.detail
          )
            ? data.detail
                .map(
                  (item) =>
                    item.msg ||
                    "Validation error"
                )
                .join(", ")
            : data.detail;
      }

      throw new Error(
        message
      );
    }

    return data;

  } catch (error) {

    if (
      error instanceof TypeError &&
      error.message
        .toLowerCase()
        .includes("fetch")
    ) {
      throw new Error(
        "Cannot connect to backend. Please make sure FastAPI is running."
      );
    }

    throw error;
  }
}


// ============================================================
// AI FRESHNESS + SHELF-LIFE PREDICTION
// ============================================================

export async function predictFoodFreshness(
  food_name,
  image_path,
  category = null,
  storage_temperature = null,
  storage_humidity = null,
  packaging_type = null,
  storage_duration = null,
  air_circulation = null,
  light_exposure = null,
  manufacturing_date = null,
  expiry_date = null
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

        category,

        storage_temperature,

        storage_humidity,

        packaging_type,

        storage_duration,

        air_circulation,

        light_exposure,

        manufacturing_date,

        expiry_date,
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
// ADMIN - USER MANAGEMENT
// ============================================================

export async function getAdminUsers() {
  return request(
    "/admin/users",
    {
      method: "GET",
    }
  );
}


export async function updateAdminUserRole(
  userId,
  role
) {

  if (!userId) {
    throw new Error(
      "User ID is required."
    );
  }

  if (!role) {
    throw new Error(
      "Role is required."
    );
  }

  return request(
    `/admin/users/${userId}/role`,
    {
      method: "PUT",

      body: JSON.stringify({
        role,
      }),
    }
  );
}


export async function updateAdminUserStatus(
  userId,
  isActive
) {

  if (!userId) {
    throw new Error(
      "User ID is required."
    );
  }

  return request(
    `/admin/users/${userId}/status`,
    {
      method: "PUT",

      body: JSON.stringify({
        is_active:
          isActive,
      }),
    }
  );
}


// ============================================================
// ADMIN - ANALYTICS
// ============================================================

export async function getAdminAnalytics() {
  return request(
    "/admin/analytics",
    {
      method: "GET",
    }
  );
}


// ============================================================
// ADMIN - COMPLETE PLATFORM FOOD INVENTORY
// ============================================================
//
// Administrator-only endpoint.
//
// Returns complete food inventory history from all users and
// all roles, including owner/user information.
//
// Existing getFoods() remains user-specific and unchanged.
// ============================================================

export async function getAdminFoods() {
  return request(
    "/admin/foods",
    {
      method: "GET",
    }
  );
}


// ============================================================
// ADMIN - SYSTEM STATUS
// ============================================================

export async function getAdminSystemStatus() {
  return request(
    "/admin/system-status",
    {
      method: "GET",
    }
  );
}


// ============================================================
// EXPORT API URL
// ============================================================

export {
  API_URL
};
