# Use an official Node.js runtime as a parent image
FROM node:20-bullseye-slim

# Install Python and pip (required for trigger.py)
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Alias python to python3
RUN ln -s /usr/bin/python3 /usr/bin/python

# Install boto3 globally for the trigger script
RUN pip3 install boto3

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install frontend dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the Next.js application
RUN npm run build

# Expose the port Next.js runs on
EXPOSE 3000

# Run the Next.js production server
CMD ["npm", "start"]
