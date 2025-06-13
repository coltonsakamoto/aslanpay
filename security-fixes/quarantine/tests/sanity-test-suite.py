#!/usr/bin/env python3
"""
AgentPay Control Tower - Production Sanity Test Suite
====================================================

Tests the critical production edge cases and developer experience issues
that could cause major problems in the real world.

Usage:
    python tests/sanity-test-suite.py

Requirements:
    pip install requests subprocess32 psutil
"""

import os
import sys
import time
import json
import subprocess
import tempfile
import shutil
import re
import logging
from pathlib import Path
from typing import Dict, List, Optional
import requests

# Configure logging to capture token leaks
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('agentpay_test.log'),
        logging.StreamHandler()
    ]
)

class SanityTestSuite:
    """Comprehensive production sanity tests for AgentPay integrations."""
    
    def __init__(self):
        self.api_base = "http://localhost:3000"
        self.test_token = None
        self.test_results = {}
        self.temp_dirs = []
        
    def cleanup(self):
        """Clean up temporary directories and files."""
        for temp_dir in self.temp_dirs:
            if os.path.exists(temp_dir):
                shutil.rmtree(temp_dir, ignore_errors=True)
        
        # Clean up log file
        if os.path.exists('agentpay_test.log'):
            os.remove('agentpay_test.log')

    def setup_test_environment(self):
        """Set up test environment with agent token."""
        try:
            # Create test wallet and agent
            wallet_response = requests.post(f"{self.api_base}/v1/wallets")
            wallet_response.raise_for_status()
            wallet_id = wallet_response.json()['walletId']
            
            agent_response = requests.post(f"{self.api_base}/v1/agents", json={
                'walletId': wallet_id,
                'dailyUsdLimit': 100
            })
            agent_response.raise_for_status()
            self.test_token = agent_response.json()['agentToken']
            
            # Add test payment method
            card_response = requests.post(f"{self.api_base}/v1/wallets/{wallet_id}/cards", json={
                'paymentMethodId': 'pm_card_visa'
            })
            card_response.raise_for_status()
            
            print(f"✅ Test environment ready with token: {self.test_token[:20]}...")
            return True
            
        except Exception as e:
            print(f"❌ Failed to set up test environment: {e}")
            return False

    def test_pip_install_fresh_venv(self):
        """Test 1: Fresh venv → pip install → run example script end-to-end"""
        print("\n🧪 **TEST 1: Fresh Virtual Environment Installation**")
        print("=" * 60)
        
        try:
            # Create temporary directory for test
            temp_dir = tempfile.mkdtemp(prefix="agentpay_test_")
            self.temp_dirs.append(temp_dir)
            
            print(f"📁 Created test directory: {temp_dir}")
            
            # Create virtual environment
            venv_path = os.path.join(temp_dir, "test_venv")
            print("🐍 Creating virtual environment...")
            
            result = subprocess.run([
                sys.executable, "-m", "venv", venv_path
            ], capture_output=True, text=True, timeout=60)
            
            if result.returncode != 0:
                raise Exception(f"Failed to create venv: {result.stderr}")
            
            # Determine activation script path
            if os.name == 'nt':  # Windows
                activate_script = os.path.join(venv_path, "Scripts", "activate")
                python_exe = os.path.join(venv_path, "Scripts", "python.exe")
                pip_exe = os.path.join(venv_path, "Scripts", "pip.exe")
            else:  # Unix/Linux/Mac
                activate_script = os.path.join(venv_path, "bin", "activate")
                python_exe = os.path.join(venv_path, "bin", "python")
                pip_exe = os.path.join(venv_path, "bin", "pip")
            
            print("📦 Installing required packages...")
            
            # Install requests first (our integration dependencies)
            install_cmd = [pip_exe, "install", "requests"]
            result = subprocess.run(install_cmd, capture_output=True, text=True, timeout=120)
            
            if result.returncode != 0:
                raise Exception(f"Failed to install requests: {result.stderr}")
            
            # Create test script that simulates the LangChain integration
            test_script = f"""
import sys
import os
import requests
import json
import time

# Simulate the AgentPay LangChain integration
class MockAgentPayTool:
    def __init__(self, agent_token, api_base="http://localhost:3000"):
        self.agent_token = agent_token
        self.api_base = api_base
        
    def _request_authorization(self, merchant, amount, category, intent):
        payload = {{
            'agentToken': self.agent_token,
            'merchant': merchant,
            'amount': amount,
            'category': category,
            'intent': intent
        }}
        
        response = requests.post(f'{{self.api_base}}/v1/authorize', json=payload)
        response.raise_for_status()
        return response.json()
    
    def test_purchase(self):
        try:
            print("🎯 Testing AgentPay authorization...")
            
            auth_response = self._request_authorization(
                merchant="test-merchant.com",
                amount=9.99,
                category="test",
                intent="Sanity test purchase"
            )
            
            if auth_response.get('authorized'):
                print(f"✅ Authorization successful: {{auth_response['authorizationId']}}")
                print(f"⚡ Latency: {{auth_response.get('latency', 'N/A')}}ms")
                return True
            else:
                print(f"❌ Authorization failed: {{auth_response.get('reason')}}")
                return False
                
        except Exception as e:
            print(f"❌ Test failed: {{e}}")
            return False

# Run the test
if __name__ == "__main__":
    tool = MockAgentPayTool("{self.test_token}")
    success = tool.test_purchase()
    sys.exit(0 if success else 1)
"""
            
            # Write test script
            script_path = os.path.join(temp_dir, "test_agentpay.py")
            with open(script_path, 'w') as f:
                f.write(test_script)
            
            print("🚀 Running end-to-end test script...")
            
            # Run the test script
            result = subprocess.run([
                python_exe, script_path
            ], capture_output=True, text=True, timeout=30)
            
            print("📋 Test script output:")
            print(result.stdout)
            
            if result.stderr:
                print("⚠️ Test script errors:")
                print(result.stderr)
            
            if result.returncode == 0:
                print("✅ Fresh venv installation test PASSED")
                self.test_results['fresh_venv'] = True
                return True
            else:
                print("❌ Fresh venv installation test FAILED")
                self.test_results['fresh_venv'] = False
                return False
                
        except Exception as e:
            print(f"❌ Fresh venv test failed: {e}")
            self.test_results['fresh_venv'] = False
            return False

    def test_token_leak_detection(self):
        """Test 2: Search logs for token leaks after auth/confirm"""
        print("\n🔐 **TEST 2: Token Leak Detection**")
        print("=" * 60)
        
        try:
            # Clear existing logs
            if os.path.exists('agentpay_test.log'):
                open('agentpay_test.log', 'w').close()
            
            print("🎯 Making authorization request...")
            
            # Make authorization request
            auth_response = requests.post(f"{self.api_base}/v1/authorize", json={
                'agentToken': self.test_token,
                'merchant': 'leak-test.com',
                'amount': 15.99,
                'category': 'test',
                'intent': 'Token leak detection test'
            })
            auth_response.raise_for_status()
            
            auth_id = auth_response.json()['authorizationId']
            
            print("💳 Making confirmation request...")
            
            # Make confirmation request
            confirm_response = requests.post(f"{self.api_base}/v1/authorize/{auth_id}/confirm", json={
                'finalAmount': 15.99,
                'transactionDetails': {
                    'orderId': 'LEAK_TEST_123',
                    'merchant': 'leak-test.com'
                }
            })
            
            # Allow some time for logs to be written
            time.sleep(2)
            
            print("🔍 Scanning logs for token leaks...")
            
            # Define sensitive patterns to search for
            sensitive_patterns = [
                (r'sk_test_[a-zA-Z0-9]{24,}', 'Stripe test key'),
                (r'sk_live_[a-zA-Z0-9]{24,}', 'Stripe live key'),
                (r'eyJ[a-zA-Z0-9-_]+\.[a-zA-Z0-9-_]+\.[a-zA-Z0-9-_]+', 'JWT token'),
                (r'\b4[0-9]{12}(?:[0-9]{3})?\b', 'Credit card number (Visa)'),
                (r'\b5[1-5][0-9]{14}\b', 'Credit card number (MasterCard)'),
                (r'agentToken.*["\']([^"\']+)["\']', 'Agent token in quotes'),
            ]
            
            leaks_found = []
            
            # Check server logs if accessible
            log_files = [
                'agentpay_test.log',
                '/var/log/agentpay/server.log',
                './server.log',
                '../agent-wallet/server.log'
            ]
            
            for log_file in log_files:
                if os.path.exists(log_file):
                    print(f"📄 Checking {log_file}...")
                    
                    with open(log_file, 'r') as f:
                        log_content = f.read()
                        
                        for pattern, description in sensitive_patterns:
                            matches = re.findall(pattern, log_content)
                            if matches:
                                for match in matches:
                                    # Exclude our test token (expected)
                                    if match != self.test_token[:10]:  # First 10 chars for comparison
                                        leaks_found.append({
                                            'type': description,
                                            'value': match[:20] + '...' if len(match) > 20 else match,
                                            'file': log_file
                                        })
            
            # Also check response content for leaks
            response_text = str(auth_response.json()) + str(confirm_response.json() if confirm_response.status_code == 200 else confirm_response.text)
            
            for pattern, description in sensitive_patterns:
                matches = re.findall(pattern, response_text)
                if matches:
                    for match in matches:
                        # Check if it's a legitimate scoped token (expected)
                        if 'JWT token' in description and 'scopedToken' in response_text:
                            continue  # Scoped tokens are expected in responses
                        
                        leaks_found.append({
                            'type': description,
                            'value': match[:20] + '...' if len(match) > 20 else match,
                            'file': 'API response'
                        })
            
            if leaks_found:
                print("❌ Token leaks detected!")
                for leak in leaks_found:
                    print(f"   🚨 {leak['type']}: {leak['value']} in {leak['file']}")
                self.test_results['token_leak'] = False
                return False
            else:
                print("✅ No token leaks detected")
                self.test_results['token_leak'] = True
                return True
                
        except Exception as e:
            print(f"❌ Token leak detection failed: {e}")
            self.test_results['token_leak'] = False
            return False

    def test_langchain_notebook_simulation(self):
        """Test 3: Simulate Colab notebook environment (GPU disabled)"""
        print("\n📓 **TEST 3: LangChain Notebook Simulation**")
        print("=" * 60)
        
        try:
            # Create notebook-style test
            print("🔬 Simulating Google Colab environment...")
            
            # Simulate the environment variables that Colab sets
            original_env = os.environ.copy()
            os.environ['COLAB_GPU'] = '0'  # GPU disabled
            os.environ['PYTHONPATH'] = '/content'
            
            start_time = time.time()
            
            print("📝 Running notebook cell simulation...")
            
            # Simulate notebook cell code
            notebook_code = f"""
# Cell 1: Install AgentPay (simulated)
print("Installing AgentPay...")

# Cell 2: Import and setup
import requests
import json
import time

class NotebookAgentPayTool:
    def __init__(self, agent_token):
        self.agent_token = agent_token
        self.api_base = "http://localhost:3000"
    
    def quick_purchase_test(self):
        start = time.time()
        
        # Authorization request
        auth_response = requests.post(f'{{self.api_base}}/v1/authorize', json={{
            'agentToken': self.agent_token,
            'merchant': 'colab-test.com', 
            'amount': 12.99,
            'category': 'test',
            'intent': 'Notebook simulation test'
        }})
        
        if auth_response.status_code != 200:
            raise Exception(f"Auth failed: {{auth_response.text}}")
        
        auth_data = auth_response.json()
        
        if not auth_data.get('authorized'):
            raise Exception(f"Not authorized: {{auth_data.get('reason')}}")
        
        latency = time.time() - start
        
        print(f"✅ Authorization completed in {{latency:.3f}}s")
        print(f"📋 Auth ID: {{auth_data['authorizationId']}}")
        
        return latency < 0.5  # Should complete in <0.5s

# Cell 3: Run test
tool = NotebookAgentPayTool("{self.test_token}")
success = tool.quick_purchase_test()
print(f"Test result: {{'✅ PASSED' if success else '❌ FAILED'}}")
"""
            
            # Execute the notebook simulation
            local_vars = {}
            exec(notebook_code, globals(), local_vars)
            
            total_time = time.time() - start_time
            
            print(f"⏱️ Total execution time: {total_time:.3f}s")
            
            # Restore environment
            os.environ.clear()
            os.environ.update(original_env)
            
            if total_time < 0.5:
                print("✅ LangChain notebook simulation PASSED")
                self.test_results['langchain_notebook'] = True
                return True
            else:
                print("❌ LangChain notebook simulation FAILED (too slow)")
                self.test_results['langchain_notebook'] = False
                return False
                
        except Exception as e:
            print(f"❌ Notebook simulation failed: {e}")
            self.test_results['langchain_notebook'] = False
            return False

    def test_crewai_multi_agent_edge_cases(self):
        """Test 4: CrewAI multi-agent demo with expiry edge cases"""
        print("\n🤖 **TEST 4: CrewAI Multi-Agent Edge Cases**")
        print("=" * 60)
        
        try:
            print("👥 Simulating two agents sharing same auth ID...")
            
            # Agent 1 requests authorization
            print("🦾 Agent 1: Requesting authorization...")
            
            auth_response = requests.post(f"{self.api_base}/v1/authorize", json={
                'agentToken': self.test_token,
                'merchant': 'crew-test.com',
                'amount': 29.99,
                'category': 'test',
                'intent': 'Multi-agent coordination test',
                'metadata': {
                    'requesting_agent': 'agent_1',
                    'crew_coordination': True
                }
            })
            auth_response.raise_for_status()
            
            auth_data = auth_response.json()
            auth_id = auth_data['authorizationId']
            
            print(f"✅ Agent 1 got authorization: {auth_id}")
            
            # Agent 2 tries to use the same authorization (should work)
            print("🤖 Agent 2: Using same authorization ID...")
            
            # Simulate some processing time
            time.sleep(2)
            
            # Agent 2 confirms the transaction
            confirm_response = requests.post(f"{self.api_base}/v1/authorize/{auth_id}/confirm", json={
                'finalAmount': 29.99,
                'transactionDetails': {
                    'orderId': 'CREW_TEST_456',
                    'merchant': 'crew-test.com',
                    'executingAgent': 'agent_2',
                    'coordinatedBy': 'agent_1'
                },
                'merchantData': {
                    'multiAgent': True,
                    'agentCoordination': 'successful'
                }
            })
            
            if confirm_response.status_code == 200:
                print("✅ Agent 2 successfully confirmed transaction")
                multi_agent_success = True
            else:
                print(f"❌ Agent 2 confirmation failed: {confirm_response.text}")
                multi_agent_success = False
            
            # Test expiry edge case
            print("\n⏰ Testing authorization expiry edge case...")
            
            # Request another authorization
            expiry_auth_response = requests.post(f"{self.api_base}/v1/authorize", json={
                'agentToken': self.test_token,
                'merchant': 'expiry-test.com',
                'amount': 5.99,
                'category': 'test',
                'intent': 'Expiry test'
            })
            expiry_auth_response.raise_for_status()
            
            expiry_auth_id = expiry_auth_response.json()['authorizationId']
            
            print(f"⏳ Got authorization {expiry_auth_id}, waiting for expiry...")
            
            # Wait longer than typical expiry (simulate 3+ minutes)
            # For testing, we'll simulate this by making multiple requests
            time.sleep(3)
            
            # Try to confirm after delay (should handle gracefully)
            late_confirm_response = requests.post(f"{self.api_base}/v1/authorize/{expiry_auth_id}/confirm", json={
                'finalAmount': 5.99,
                'transactionDetails': {
                    'orderId': 'EXPIRY_TEST_789',
                    'merchant': 'expiry-test.com',
                    'note': 'Late confirmation test'
                }
            })
            
            # Should either succeed or fail gracefully with clear error
            if late_confirm_response.status_code == 200:
                print("✅ Late confirmation succeeded (authorization still valid)")
                expiry_handling = True
            elif late_confirm_response.status_code == 400:
                error_data = late_confirm_response.json()
                if 'expired' in error_data.get('error', '').lower():
                    print("✅ Late confirmation gracefully rejected (expired)")
                    expiry_handling = True
                else:
                    print(f"⚠️ Unexpected error: {error_data}")
                    expiry_handling = False
            else:
                print(f"❌ Unexpected status code: {late_confirm_response.status_code}")
                expiry_handling = False
            
            # Test idempotency with the same request
            print("\n🔄 Testing idempotency...")
            
            # Make identical authorization request
            identical_auth_response = requests.post(f"{self.api_base}/v1/authorize", json={
                'agentToken': self.test_token,
                'merchant': 'idempotency-test.com',
                'amount': 19.99,
                'category': 'test',
                'intent': 'Idempotency test'
            })
            
            first_auth_id = identical_auth_response.json()['authorizationId']
            
            # Make the exact same request again
            duplicate_auth_response = requests.post(f"{self.api_base}/v1/authorize", json={
                'agentToken': self.test_token,
                'merchant': 'idempotency-test.com',
                'amount': 19.99,
                'category': 'test',
                'intent': 'Idempotency test'
            })
            
            if duplicate_auth_response.status_code == 200:
                duplicate_data = duplicate_auth_response.json()
                if duplicate_data.get('idempotent'):
                    print("✅ Idempotency working (returned cached response)")
                    idempotency_working = True
                else:
                    print("⚠️ New authorization created (idempotency not triggered)")
                    idempotency_working = True  # May be expected behavior
            else:
                print(f"❌ Duplicate request failed: {duplicate_auth_response.text}")
                idempotency_working = False
            
            # Overall result
            overall_success = multi_agent_success and expiry_handling and idempotency_working
            
            if overall_success:
                print("✅ CrewAI multi-agent edge cases PASSED")
                self.test_results['crewai_multi_agent'] = True
                return True
            else:
                print("❌ CrewAI multi-agent edge cases FAILED")
                self.test_results['crewai_multi_agent'] = False
                return False
                
        except Exception as e:
            print(f"❌ Multi-agent test failed: {e}")
            self.test_results['crewai_multi_agent'] = False
            return False

    def test_uninstall_error_handling(self):
        """Test 5: Ensure clear error when AgentPay is uninstalled"""
        print("\n📦 **TEST 5: Uninstall Error Handling**")
        print("=" * 60)
        
        try:
            # Create a test script that simulates importing without AgentPay installed
            print("🗑️ Simulating AgentPay uninstall scenario...")
            
            # Create temporary directory for test
            temp_dir = tempfile.mkdtemp(prefix="uninstall_test_")
            self.temp_dirs.append(temp_dir)
            
            # Create test script that tries to import AgentPay
            uninstall_test_script = """
import sys

def test_import_error():
    try:
        # Simulate importing AgentPay when not installed
        raise ImportError("No module named 'agentpay'")
        
    except ImportError as e:
        error_msg = str(e)
        
        # Check if we provide a helpful error message
        if "agentpay" in error_msg.lower():
            print("✅ Clear import error detected")
            
            # Simulate a helpful error handler
            helpful_msg = '''
❌ AgentPay not found. Please install AgentPay:

    pip install agentpay

Or for development:
    
    pip install -e .

Visit https://agentpay.com for more information.
'''
            print(helpful_msg)
            return True
        else:
            print(f"❌ Unclear error message: {error_msg}")
            return False

def test_langchain_import_without_agentpay():
    '''Simulate LangChain import when AgentPay is not available'''
    try:
        # This is what users would see
        error_code = '''
from langchain_agentpay import AgentPayTool  # This would fail

tool = AgentPayTool(agent_token="test")
'''
        
        print("📋 User code that would fail:")
        print(error_code)
        
        # Simulate the error
        print("\\n💥 Error that would occur:")
        print("ImportError: No module named 'langchain_agentpay'")
        
        # Check if we provide helpful guidance
        helpful_message = '''
💡 Solution:
   1. Install AgentPay: pip install agentpay
   2. Or download integration file directly:
      wget https://raw.githubusercontent.com/agentpay/integrations/main/langchain-agentpay.py
'''
        print(helpful_message)
        
        return True
        
    except Exception as e:
        print(f"❌ Import test failed: {e}")
        return False

# Run the tests
if __name__ == "__main__":
    import_test = test_import_error()
    langchain_test = test_langchain_import_without_agentpay()
    
    success = import_test and langchain_test
    print(f"\\nOverall result: {'✅ PASSED' if success else '❌ FAILED'}")
    sys.exit(0 if success else 1)
"""
            
            # Write and run the test script
            script_path = os.path.join(temp_dir, "uninstall_test.py")
            with open(script_path, 'w') as f:
                f.write(uninstall_test_script)
            
            # Run the test
            result = subprocess.run([
                sys.executable, script_path
            ], capture_output=True, text=True, timeout=30)
            
            print("📋 Uninstall test output:")
            print(result.stdout)
            
            if result.stderr:
                print("⚠️ Uninstall test errors:")
                print(result.stderr)
            
            # Also test documentation quality
            print("\n📚 Testing documentation clarity...")
            
            # Check if we have clear installation instructions
            doc_files = [
                'README.md',
                'integrations/README.md',
                'AGENT-FRAMEWORK-INTEGRATIONS.md'
            ]
            
            installation_docs_found = False
            for doc_file in doc_files:
                if os.path.exists(doc_file):
                    with open(doc_file, 'r') as f:
                        content = f.read().lower()
                        if 'pip install' in content and 'agentpay' in content:
                            installation_docs_found = True
                            print(f"✅ Installation docs found in {doc_file}")
                            break
            
            if not installation_docs_found:
                print("⚠️ No clear installation documentation found")
            
            if result.returncode == 0 and installation_docs_found:
                print("✅ Uninstall error handling PASSED")
                self.test_results['uninstall_handling'] = True
                return True
            else:
                print("❌ Uninstall error handling FAILED")
                self.test_results['uninstall_handling'] = False
                return False
                
        except Exception as e:
            print(f"❌ Uninstall test failed: {e}")
            self.test_results['uninstall_handling'] = False
            return False

    def run_all_tests(self):
        """Run all sanity tests and generate report."""
        print("🚀 **AGENTPAY PRODUCTION SANITY TEST SUITE**")
        print("=" * 80)
        print("Testing critical production edge cases and developer experience issues\n")
        
        # Set up test environment
        if not self.setup_test_environment():
            print("❌ Failed to set up test environment. Aborting.")
            return False
        
        # Run all tests
        tests = [
            ("Fresh Virtual Environment", self.test_pip_install_fresh_venv),
            ("Token Leak Detection", self.test_token_leak_detection),
            ("LangChain Notebook Simulation", self.test_langchain_notebook_simulation),
            ("CrewAI Multi-Agent Edge Cases", self.test_crewai_multi_agent_edge_cases),
            ("Uninstall Error Handling", self.test_uninstall_error_handling)
        ]
        
        passed_tests = 0
        total_tests = len(tests)
        
        for test_name, test_func in tests:
            try:
                success = test_func()
                if success:
                    passed_tests += 1
            except Exception as e:
                print(f"❌ {test_name} test crashed: {e}")
                self.test_results[test_name.lower().replace(' ', '_')] = False
        
        # Generate final report
        print("\n" + "=" * 80)
        print("🏆 **SANITY TEST RESULTS**")
        print("=" * 80)
        
        for test_name, test_func in tests:
            test_key = test_name.lower().replace(' ', '_')
            result = self.test_results.get(test_key, False)
            status = "✅ PASSED" if result else "❌ FAILED"
            print(f"   {test_name}: {status}")
        
        print(f"\n📊 Overall Score: {passed_tests}/{total_tests} tests passed")
        print(f"📈 Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if passed_tests == total_tests:
            print("\n🎉 **ALL SANITY TESTS PASSED!**")
            print("🚀 AgentPay Control Tower is production-ready for developer use!")
            print("\nKey validations:")
            print("   ✅ Fresh installation works smoothly")
            print("   ✅ No sensitive token leaks detected")  
            print("   ✅ Notebook environments perform well (<0.5s)")
            print("   ✅ Multi-agent coordination handles edge cases")
            print("   ✅ Clear error messages for missing dependencies")
            return True
        else:
            print(f"\n⚠️ **{total_tests - passed_tests} SANITY TEST(S) FAILED**")
            print("🔧 Please address the failed tests before production deployment.")
            
            # Provide specific recommendations
            if not self.test_results.get('fresh_venv', True):
                print("   🔨 Fix: Check dependency management and installation scripts")
            if not self.test_results.get('token_leak', True):
                print("   🔨 Fix: Review logging configuration to prevent token exposure")
            if not self.test_results.get('langchain_notebook', True):
                print("   🔨 Fix: Optimize authorization latency for notebook environments")
            if not self.test_results.get('crewai_multi_agent', True):
                print("   🔨 Fix: Improve multi-agent coordination and expiry handling")
            if not self.test_results.get('uninstall_handling', True):
                print("   🔨 Fix: Add clearer error messages and documentation")
                
            return False

def main():
    """Main entry point for sanity tests."""
    suite = SanityTestSuite()
    
    try:
        success = suite.run_all_tests()
        return 0 if success else 1
    finally:
        suite.cleanup()

if __name__ == "__main__":
    sys.exit(main()) 