# Food Freshness Monitoring Platform

An AI-assisted platform for monitoring food freshness, estimating shelf life, managing inventory, and generating freshness reports.

## Features

- User registration and login
- Food inventory and batch management
- Image-based food freshness analysis
- Visual quality indicators and freshness reports
- Shelf-life estimation
- Recommendations and reporting dashboards

## Technology Stack

- Frontend: React and Vite
- Backend: Python and FastAPI
- Database: PostgreSQL
- Machine Learning: TensorFlow/Keras

## Project Structure

- rontend/ — React application
- ackend-Infosys-FF/ — FastAPI backend
- dataset/ — Dataset documentation
- Datasets/ — Local dataset and model resources

## Local Setup

### Backend

1. Open a terminal in ackend-Infosys-FF.
2. Create and activate a Python virtual environment.
3. Install dependencies using pip install -r requirements.txt.
4. Configure DATABASE_URL in a local .env file.
5. Start the backend using uvicorn main:app --reload.

### Frontend

1. Open a terminal in rontend.
2. Run 
pm install.
3. Run 
pm run dev.

## Dataset and Model

Large training datasets are not included in this repository because of their size. See the dataset/ folder for documentation. Check dataset licensing before redistribution.

## Deployment

The frontend and backend can be deployed as separate services. Configure database credentials, API URLs, and other secrets using the hosting platform's environment variables.

## Disclaimer

Image-based freshness predictions are estimates and should not replace proper food-safety checks.
