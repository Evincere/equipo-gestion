FROM node:22-alpine

# Directorio de trabajo
WORKDIR /app

# Copiar configuración de dependencias
COPY package*.json ./

# Copiar el resto del código de la aplicación y base de datos
COPY . .

# Exponer el puerto 3000
EXPOSE 3000

# Variables de entorno por defecto
ENV PORT=3000
ENV NODE_ENV=production

# Comando de inicio del servidor
CMD ["node", "server.js"]
