# 🚨 **Production Sanity Tests - Critical Edge Cases Covered**

## 📋 **Overview**

These comprehensive sanity tests address the **5 critical production edge cases** that could cause major issues for developers using AgentPay Control Tower integrations. Each test validates a specific failure mode that has caused problems in real-world AI agent deployments.

---

## 🧪 **Test Coverage Matrix**

| **Critical Area** | **Test Implementation** | **Why It Matters** | **Validation Method** |
|-------------------|------------------------|-------------------|----------------------|
| **Pip install / npm link** | `test_pip_install_fresh_venv()` | Confirms no hidden deps or path issues | Fresh venv → install → run example script end-to-end |
| **Token leak** | `test_token_leak_detection()` | Keeps you PCI-scope A-only | Search logs for `sk_test` or PAN fragments after auth/confirm |
| **LangChain notebook** | `test_langchain_notebook_simulation()` | Many devs copy notebooks verbatim | Run in Colab (GPU disabled) → should authorize & confirm in <0.5s |
| **CrewAI multi-agent demo** | `test_crewai_multi_agent_edge_cases()` | Validates idempotency + expiry edge-case | Two agents sharing same auth ID; retry confirm after 3 min expire |
| **`pip uninstall agentpay`** | `test_uninstall_error_handling()` | Prevents opaque stack traces for non-users | Ensure LangChain import error is clear ("Please install AgentPay") |

---

## 🔧 **Test 1: Fresh Virtual Environment Installation**

### **The Problem**
Developers often encounter mysterious import errors, dependency conflicts, or path issues when installing AgentPay in fresh environments. This is especially common in:
- Docker containers
- CI/CD pipelines  
- Fresh developer machines
- Virtual environments with minimal packages

### **What We Test**
```python
def test_pip_install_fresh_venv():
    # 1. Create completely fresh virtual environment
    # 2. Install only essential dependencies (requests)
    # 3. Run mock AgentPay integration script
    # 4. Test basic authorization flow
    # 5. Verify no hidden dependency issues
```

### **Success Criteria**
- ✅ Virtual environment creates successfully
- ✅ Dependencies install without conflicts
- ✅ Authorization completes in fresh environment
- ✅ No import errors or missing modules

### **Real-World Impact**
Prevents the #1 developer support issue: "It works on my machine but not in production/Docker/CI"

---

## 🔐 **Test 2: Token Leak Detection**

### **The Problem**
Accidentally logging sensitive tokens can:
- Expose Stripe keys in application logs
- Leak agent tokens in debug output
- Include credit card numbers in responses
- Violate PCI compliance requirements

### **What We Test**
```python
def test_token_leak_detection():
    # 1. Make authorization and confirmation requests
    # 2. Scan all log files for sensitive patterns:
    #    - sk_test_* / sk_live_* (Stripe keys)
    #    - Credit card numbers (PAN data)
    #    - Agent tokens in plain text
    #    - JWT tokens in unexpected places
    # 3. Check API responses for leaks
    # 4. Verify scoped tokens are properly handled
```

### **Security Patterns Detected**
- `sk_test_[a-zA-Z0-9]{24,}` - Stripe test keys
- `sk_live_[a-zA-Z0-9]{24,}` - Stripe live keys  
- `\b4[0-9]{12}(?:[0-9]{3})?\b` - Visa card numbers
- `\b5[1-5][0-9]{14}\b` - MasterCard numbers
- Agent tokens in plain text

### **Success Criteria**
- ✅ No Stripe keys in logs or responses
- ✅ No credit card numbers exposed
- ✅ Agent tokens properly redacted
- ✅ Scoped tokens only where expected

### **Real-World Impact**
Maintains **PCI Scope A compliance** and prevents security breaches that could shut down the platform.

---

## 📓 **Test 3: LangChain Notebook Simulation**

### **The Problem**
Google Colab and Jupyter notebooks are where many developers first try AI agent frameworks. Performance issues here create terrible first impressions because:
- Notebooks feel slow and unresponsive
- Developers assume the service is broken
- Copy-paste code from notebooks becomes production code
- GPU-disabled environments are common

### **What We Test**
```python
def test_langchain_notebook_simulation():
    # 1. Simulate Google Colab environment variables
    # 2. Run typical notebook cells:
    #    - Import AgentPay
    #    - Create agent tool
    #    - Make purchase authorization
    # 3. Measure total execution time
    # 4. Verify <0.5s completion (notebook-friendly)
```

### **Environment Simulation**
```python
os.environ['COLAB_GPU'] = '0'  # GPU disabled
os.environ['PYTHONPATH'] = '/content'  # Colab path structure
```

### **Success Criteria**
- ✅ Authorization completes in <0.5 seconds
- ✅ No environment-specific errors
- ✅ Clear output for notebook users
- ✅ Responsive feeling for interactive use

### **Real-World Impact**
Ensures **smooth developer onboarding** and prevents abandonment during first-time use in popular notebook environments.

---

## 🤖 **Test 4: CrewAI Multi-Agent Edge Cases**

### **The Problem**
CrewAI's multi-agent architecture creates unique edge cases:
- Multiple agents sharing authorization IDs
- Race conditions during confirmation
- Authorization expiry during agent coordination
- Idempotency issues with retries

### **What We Test**
```python
def test_crewai_multi_agent_edge_cases():
    # 1. Agent 1 requests authorization
    # 2. Agent 2 uses same authorization ID (coordination)
    # 3. Test expiry handling:
    #    - Request authorization
    #    - Wait past expiry window
    #    - Attempt late confirmation
    # 4. Test idempotency:
    #    - Make identical requests
    #    - Verify proper deduplication
```

### **Edge Cases Validated**
- **Shared Authorization**: Multiple agents using same auth ID
- **Expiry Handling**: Graceful rejection of expired authorizations
- **Idempotency**: Duplicate request protection
- **Race Conditions**: Concurrent agent operations

### **Success Criteria**
- ✅ Multi-agent coordination works smoothly
- ✅ Expired confirmations fail gracefully
- ✅ Idempotent responses prevent duplicates
- ✅ Clear error messages for edge cases

### **Real-World Impact**
Prevents **crew coordination failures** and ensures enterprise reliability for complex multi-agent workflows.

---

## 📦 **Test 5: Uninstall Error Handling**

### **The Problem**
When developers uninstall AgentPay or have import issues, they get confusing Python stack traces instead of helpful guidance:
```python
ModuleNotFoundError: No module named 'langchain_agentpay'
  File "agent.py", line 3, in <module>
    from langchain_agentpay import AgentPayTool
```

### **What We Test**
```python
def test_uninstall_error_handling():
    # 1. Simulate missing AgentPay import
    # 2. Test error message clarity
    # 3. Verify helpful guidance is provided
    # 4. Check documentation availability
    # 5. Ensure clear installation instructions
```

### **Error Guidance Provided**
```
❌ AgentPay not found. Please install AgentPay:

    pip install agentpay

Or for development:
    pip install -e .

Visit https://agentpay.com for more information.
```

### **Success Criteria**
- ✅ Clear error message identifies missing package
- ✅ Helpful installation instructions provided
- ✅ Documentation links are available
- ✅ No opaque Python stack traces

### **Real-World Impact**
Reduces **developer support burden** and provides self-service resolution for common import issues.

---

## 🚀 **Running the Tests**

### **Quick Sanity Check (2 minutes)**
```bash
# Fast validation of critical issues
python tests/quick-sanity-check.py
```

### **Comprehensive Suite (10 minutes)**
```bash
# Full production readiness validation
python tests/sanity-test-suite.py

# Or use the shell script
./run-sanity-tests.sh
```

### **Automated CI/CD Integration**
```yaml
# GitHub Actions example
- name: Run AgentPay Sanity Tests
  run: |
    python tests/sanity-test-suite.py
  env:
    AGENTPAY_SERVER: http://localhost:3000
```

---

## 📊 **Test Results Interpretation**

### **All Tests Pass ✅**
```
🎉 ALL SANITY TESTS PASSED!
🚀 AgentPay Control Tower is production-ready for developer use!

Key validations:
   ✅ Fresh installation works smoothly
   ✅ No sensitive token leaks detected  
   ✅ Notebook environments perform well (<0.5s)
   ✅ Multi-agent coordination handles edge cases
   ✅ Clear error messages for missing dependencies
```

### **Some Tests Fail ❌**
```
⚠️ 2 SANITY TEST(S) FAILED
🔧 Please address the failed tests before production deployment.

🔨 Fix: Check dependency management and installation scripts
🔨 Fix: Review logging configuration to prevent token exposure
```

---

## 🎯 **Production Deployment Checklist**

Before deploying AgentPay Control Tower to production:

- [ ] **Fresh Install Test**: New environments work smoothly
- [ ] **Token Security**: No leaks in logs or responses  
- [ ] **Performance**: <0.5s authorization for notebooks
- [ ] **Multi-Agent**: Coordination handles edge cases
- [ ] **Error Handling**: Clear messages for missing dependencies
- [ ] **Load Testing**: System handles expected traffic
- [ ] **Monitoring**: Real-time alerts for failures
- [ ] **Documentation**: Installation guides are current

---

## 🔄 **Continuous Validation**

These tests should be run:
- ✅ **Pre-deployment**: Before any production release
- ✅ **CI/CD Pipeline**: On every pull request merge
- ✅ **Weekly**: Scheduled production validation
- ✅ **After Dependencies**: When updating packages
- ✅ **Before Marketing**: Prior to developer announcements

---

## 💡 **Why These Tests Matter**

**Developer Experience is Critical for Platform Success**

1. **Fresh Install Issues** → Developers abandon immediately
2. **Token Leaks** → Security breaches shut down platforms  
3. **Slow Notebooks** → Bad first impressions in primary learning environment
4. **Multi-Agent Failures** → Enterprise customers lose confidence
5. **Poor Error Messages** → High support burden and frustration

**These 5 areas represent the most common failure modes that prevent AI agent platforms from achieving widespread adoption.**

By validating these edge cases, AgentPay Control Tower ensures:
- 🚀 **Smooth developer onboarding**
- 🔐 **Enterprise-grade security** 
- ⚡ **Responsive performance**
- 🤖 **Reliable multi-agent coordination**
- 💬 **Clear error handling**

**The result: Developers trust the platform and build production applications on AgentPay.** 🌟 