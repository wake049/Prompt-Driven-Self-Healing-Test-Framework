#!/usr/bin/env python3
"""
Milestone 2 Demo Script
Quick demonstration of all M1 & M2 features
"""

import requests
import json
import time
from typing import Dict, Any

BASE_URL = "http://localhost:8000"

def print_banner(text: str):
    print(f"\n{'='*60}")
    print(f"  {text}")
    print(f"{'='*60}")

def print_section(text: str):
    print(f"\n🔹 {text}")
    print("-" * 40)

def pretty_print_json(data: Dict[Any, Any]):
    print(json.dumps(data, indent=2))

def check_server():
    """Check if server is running"""
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=5)
        if response.status_code == 200:
            print("✅ Server is running!")
            return True
        else:
            print(f"❌ Server responded with status {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"❌ Server is not accessible: {e}")
        print("💡 Make sure to start the server first: python app.py")
        return False

def demo_milestone1():
    """Demonstrate Milestone 1 features"""
    print_banner("MILESTONE 1: AI-Powered Intent Classification")
    
    print_section("Natural Language Processing Examples")
    
    # Test various prompts
    test_prompts = [
        "login",
        "please log in to the application", 
        "open https://google.com",
        "verify the page title",
        "book a flight to Paris"  # Unknown intent
    ]
    
    for prompt in test_prompts:
        print(f"\n📝 Prompt: '{prompt}'")
        try:
            response = requests.post(
                f"{BASE_URL}/plan",
                json={"prompt": prompt},
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                print(f"✅ Generated {len(data['actions'])} actions:")
                for i, action in enumerate(data['actions'][:3], 1):  # Show first 3
                    print(f"   {i}. {action['name']} -> {action['params']}")
                if len(data['actions']) > 3:
                    print(f"   ... and {len(data['actions']) - 3} more actions")
            else:
                print(f"❌ Error: {response.json()}")
                
        except Exception as e:
            print(f"❌ Request failed: {e}")
        
        time.sleep(1)  # Brief pause for readability

def demo_milestone2():
    """Demonstrate Milestone 2 features"""
    print_banner("MILESTONE 2: Enhanced Action Catalog & Frontend")
    
    print_section("Action Catalog API Endpoints")
    
    # Test catalog endpoints
    endpoints = [
        ("/catalog/stats", "System Statistics"),
        ("/catalog/intents", "Supported Intents"),
        ("/catalog/templates/LOGIN_BASIC", "Login Template Details"),
        ("/catalog/templates/ADD_TO_CART", "E-commerce Template"),
    ]
    
    for endpoint, description in endpoints:
        print(f"\n📊 {description}")
        try:
            response = requests.get(f"{BASE_URL}{endpoint}", timeout=10)
            if response.status_code == 200:
                data = response.json()
                if endpoint == "/catalog/stats":
                    print(f"   • Total Intents: {data['total_intents']}")
                    print(f"   • Total Templates: {data['total_templates']}")
                    print(f"   • API Version: {data['version']}")
                elif endpoint == "/catalog/intents":
                    print(f"   • Available Intents: {', '.join(data.keys())}")
                else:
                    print(f"   • Template has {len(data)} action steps")
            else:
                print(f"   ❌ Error: {response.status_code}")
        except Exception as e:
            print(f"   ❌ Request failed: {e}")
    
    print_section("Direct Intent Processing")
    
    # Test direct intent API
    print(f"\n🎯 Testing direct intent: 'LOGIN' with custom context")
    try:
        response = requests.post(
            f"{BASE_URL}/catalog/actions",
            params={"intent": "LOGIN"},
            json={"username": "demo_user", "password": "demo_pass"},
            timeout=10
        )
        
        if response.status_code == 200:
            actions = response.json()
            print(f"✅ Generated {len(actions)} login actions directly")
            for i, action in enumerate(actions[:2], 1):
                print(f"   {i}. {action['name']}")
        else:
            print(f"❌ Error: {response.json()}")
    except Exception as e:
        print(f"❌ Request failed: {e}")

def demo_frontend_integration():
    """Show frontend integration capabilities"""
    print_banner("FRONTEND INTEGRATION")
    
    print_section("Web UI Features")
    
    print("🌐 Frontend Features Available:")
    print("   • Interactive prompt input with examples")
    print("   • Real-time AI plan generation") 
    print("   • Action preview and visualization")
    print("   • System statistics dashboard")
    print("   • Responsive design for mobile/desktop")
    
    print(f"\n🔗 Access the Web UI at:")
    print(f"   http://localhost:8000/ui/")
    
    print(f"\n📱 Frontend communicates with backend via:")
    print(f"   • CORS-enabled REST API")
    print(f"   • JSON request/response format")
    print(f"   • Real-time health monitoring")

def demo_advanced_features():
    """Demonstrate advanced M2 capabilities"""
    print_banner("ADVANCED MILESTONE 2 FEATURES")
    
    print_section("Enhanced Action Templates")
    
    advanced_templates = [
        "LOGIN_WITH_2FA",
        "COMPLETE_PURCHASE", 
        "MOBILE_SWIPE_SCROLL",
        "FORM_FILL_BASIC"
    ]
    
    for template in advanced_templates:
        try:
            response = requests.get(f"{BASE_URL}/catalog/templates/{template}", timeout=5)
            if response.status_code == 200:
                actions = response.json()
                print(f"✅ {template}: {len(actions)} steps")
            else:
                print(f"❌ {template}: Not available")
        except:
            print(f"❌ {template}: Request failed")
    
    print_section("URL Extraction Intelligence")
    
    print("🧠 Testing intelligent URL extraction...")
    smart_prompts = [
        "open https://github.com and verify it loads",
        "visit https://stackoverflow.com", 
        "go to the login page at https://app.example.com/login"
    ]
    
    for prompt in smart_prompts:
        try:
            response = requests.post(f"{BASE_URL}/plan", json={"prompt": prompt}, timeout=5)
            if response.status_code == 200:
                data = response.json()
                first_action = data['actions'][0]
                if first_action['name'] == 'open_url':
                    extracted_url = first_action['params']['url']
                    print(f"✅ Extracted: {extracted_url}")
        except:
            print(f"❌ Failed to process: {prompt}")

def main():
    """Run complete demo"""
    print_banner("🚀 CAPSTONE PROJECT MILESTONE 2 DEMO")
    print("AI-Powered Test Automation Framework")
    print("Natural Language → Executable Test Plans")
    
    # Check server first
    if not check_server():
        return
    
    # Run demos
    demo_milestone1()
    demo_milestone2() 
    demo_frontend_integration()
    demo_advanced_features()
    
    print_banner("✨ DEMO COMPLETE")
    print("🎯 All Milestone 1 & 2 features demonstrated!")
    print("📊 Key Achievements:")
    print("   ✅ ML-powered intent classification")
    print("   ✅ Natural language understanding")
    print("   ✅ Comprehensive action catalog")
    print("   ✅ REST API with 10+ endpoints")
    print("   ✅ Web frontend integration")
    print("   ✅ Advanced template system")
    print("   ✅ Mobile & e-commerce workflows")
    
    print(f"\n🌐 Try the Web UI: http://localhost:8000/ui/")
    print(f"📖 API Docs: http://localhost:8000/docs")

if __name__ == "__main__":
    main()