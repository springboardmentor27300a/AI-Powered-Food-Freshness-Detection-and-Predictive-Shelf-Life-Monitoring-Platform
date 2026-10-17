FROM nginx:alpine

# Copy custom nginx configuration to serve on port 5500
RUN printf 'server {\n\
    listen 5500;\n\
    server_name localhost;\n\
    location / {\n\
        root /usr/share/nginx/html;\n\
        index index.html;\n\
        try_files $uri $uri/ /index.html;\n\
    }\n\
}\n' > /etc/nginx/conf.d/default.conf

# Copy all static frontend assets into web root
COPY . /usr/share/nginx/html

# Expose frontend port
EXPOSE 5500

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
