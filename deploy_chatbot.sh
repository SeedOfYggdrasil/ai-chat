#!/bin/bash

# -------------------------------------------------------------------------------
# -------------------------------------------------------------------------------
# SOJOURNI Auto-Deployment Script v. 1.0.0
# -------------------------------------------------------------------------------
# Fullstack AI Chatbot Interface
# Developed by Alex Pariah
# -------------------------------------------------------------------------------
# GitHub Repo: https://github.com/G0dKing/ai-chat
# Powered By: Node.js, React.js, Linode, Ngrok, and Ollama
# Tested on Ubuntu WSL via Windows 11 Pro
# -------------------------------------------------------------------------------
# This software is distributed under the MIT License (https://mit-license.org/)
# -------------------------------------------------------------------------------
# Description:
#   Automation script for a proof-of-concept deployment of the "Sojourni" chatbot application
# -------------------------------------------------------------------------------
# Requirements:
#   1. Ollama (API) serving locally on port 11434
#   2. Latest versions of Llama-3, Codellama, Mistral, and Gemma language models
#   3. A locally authorized [free] ngrok account + static ngrok domain
#   4. A remote server [Linode] that:
#         a) serves static frontend build files via HTTPS to custom domain (NOT ngrok domain)
#         b) proxies API requests between front/backend
#         c) reverse-proxies API requests between remote application and local Ollama instance via the endpoint exposed via ngrok
#   5. [OPTIONAL] The "g0dking" development environment (available at https://github.com/G0dKing/init.sh)
#   6. [OPTIONAL] Latest NVIDIA "CUDA" Drivers (optional, but dramatically improves performance)
# -------------------------------------------------------------------------------
# -------------------------------------------------------------------------------

chk_colors() {
    local file=$HOME/g0dking/files/config/colors.config

    if [[ -z "${red}" ]]; then
        if [ -e $file ] && [ -f $file ]; then
            . $file
        else
            red='\033[0;31m'
            green='\033[0;32m'
            yellow='\033[1;33m'
            nc='\033[0m'
        fi
    fi
}

_error() {
    local err_msg=$1
    echo -e "${red}ERROR${nc}: ${yellow}${err_msg}${nc}"    
}

ollama_err() {
    local cmd="${red}curl -fsSL https://ollama.com/install.sh | sh${nc}"

    if ! command -v ollama &>/dev/null; then
        _error "Ollama not found on this system. Please install it by running $cmd, then re-run this script."
    else
        _error "An unknown error has occurred."
    fi
    return 1
}

chk_if_ollama() {
    local port=$1
    local cmd=$(sudo netstat -tvulnp | grep :$port)

    if [[ -z "$cmd" ]]; then
        ollama serve || ollama_err
    else
        echo -e "${green}Ollama instance is already running!${nc}"
    fi
    return 0  
}

chk_code() {
    local service=$1
    curl -o /dev/null -s -w "%{http_code}\n" $service
}

deploy_chatbot() {
    local host=localhost
    local port=11434
    local ollama_endpoint=http://$host:$port/api/generate

    local ngrok_domain=amusing-stag-intense.ngrok-free.app
    local frontend_url=https://chat.alexpariah.com

    local status_frontend=$(chk_code $frontend_url)
    local status_tunnel=$(chk_code https://$ngrok_domain)
    local status_api=$(chk_code $ollama_endpoint)

    chk_colors
    chk_if_ollama $port

    if [[ $? -ne 0 ]]; then
        return 1
    else
        if [[ $status_frontend -eq 200 ]] && [[ $status_tunnel -ne 200 ]] && [[ $status_api -eq 200 ]]; then 
            screen -dmS ngrok_live ngrok http --host-header="$host" --domain="$ngrok_domain" "$port" || _error "Could not tunnel API."
        fi    
    fi
}

deploy_chatbot
