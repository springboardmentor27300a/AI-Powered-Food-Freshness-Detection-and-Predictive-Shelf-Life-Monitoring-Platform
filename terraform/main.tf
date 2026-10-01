terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# ── Variables ─────────────────────────────────────────────────────
variable "aws_region" {
  description = "AWS region to deploy into"
  default     = "us-east-1"
}

variable "key_pair_name" {
  description = "Name of an existing EC2 key pair for SSH access"
  type        = string
}

variable "app_secret_key" {
  description = "Secret key for the FastAPI app"
  type        = string
  sensitive   = true
}

variable "instance_type" {
  description = "EC2 instance type"
  default     = "t3.medium"   # t2.micro is too small for TensorFlow
}

# ── Security Group ────────────────────────────────────────────────
resource "aws_security_group" "freshness_sg" {
  name        = "food-freshness-sg"
  description = "Security group for Food Freshness Platform"

  # SSH
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "SSH access"
  }

  # Frontend (HTTP)
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Frontend HTTP"
  }

  # Backend API
  ingress {
    from_port   = 8000
    to_port     = 8000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "FastAPI backend"
  }

  # HTTPS (for future SSL)
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTPS"
  }

  # All outbound traffic
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name    = "food-freshness-sg"
    Project = "FoodFreshnessPlatform"
  }
}

# ── EC2 Instance ──────────────────────────────────────────────────
resource "aws_instance" "freshness_server" {
  # Ubuntu 22.04 LTS (us-east-1) — update AMI ID if deploying to another region
  ami                    = "ami-0c7217cdde317cfec"
  instance_type          = var.instance_type
  key_name               = var.key_pair_name
  vpc_security_group_ids = [aws_security_group.freshness_sg.id]

  # Allocate enough storage for TensorFlow model + Docker images
  root_block_device {
    volume_size = 20  # GB
    volume_type = "gp3"
  }

  # Bootstrap script — runs once on first launch
  user_data = <<-EOF
    #!/bin/bash
    set -e

    # Update system
    apt-get update -y
    apt-get upgrade -y

    # Install Docker
    apt-get install -y ca-certificates curl gnupg
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    apt-get update -y
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

    # Start Docker
    systemctl enable docker
    systemctl start docker
    usermod -aG docker ubuntu

    # Install Git
    apt-get install -y git

    # Clone the repository
    cd /home/ubuntu
    git clone https://github.com/${var.github_repo} food-freshness-monitoring-platform
    cd food-freshness-monitoring-platform

    # Write environment file
    cat > .env <<ENVEOF
    APP_SECRET_KEY=${var.app_secret_key}
    FRONTEND_URL=http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)
    ENVEOF

    # Build and start all services
    docker compose up -d --build

    echo "Deployment complete!"
  EOF

  tags = {
    Name    = "FoodFreshnessServer"
    Project = "FoodFreshnessPlatform"
  }
}

# ── Elastic IP (stable public IP) ────────────────────────────────
resource "aws_eip" "freshness_eip" {
  instance = aws_instance.freshness_server.id
  domain   = "vpc"

  tags = {
    Name    = "food-freshness-eip"
    Project = "FoodFreshnessPlatform"
  }
}

# ── Variable for GitHub repo ──────────────────────────────────────
variable "github_repo" {
  description = "GitHub repo in format owner/repo-name"
  type        = string
  default     = "your-github-username/food-freshness-monitoring-platform"
}

# ── Outputs ───────────────────────────────────────────────────────
output "public_ip" {
  description = "Elastic IP of the deployed server"
  value       = aws_eip.freshness_eip.public_ip
}

output "frontend_url" {
  description = "URL to access the frontend"
  value       = "http://${aws_eip.freshness_eip.public_ip}"
}

output "backend_url" {
  description = "URL to access the backend API"
  value       = "http://${aws_eip.freshness_eip.public_ip}:8000"
}

output "ssh_command" {
  description = "SSH command to connect to the server"
  value       = "ssh -i ~/.ssh/${var.key_pair_name}.pem ubuntu@${aws_eip.freshness_eip.public_ip}"
}
