# 🤖 CrewAI + Aslan Integration

Complete example showing how to integrate Aslan payment capabilities into CrewAI multi-agent crews for coordinated purchasing decisions.

## 🚀 Quick Start

### 1. Install Dependencies

```bash
pip install crewai aslanpay python-dotenv
# OR for Node.js
npm install @aslanpay/sdk dotenv
```

### 2. Set Environment Variables

```bash
# Copy from project root
cp ../../.env.example .env

# Add your keys
ASLAN_API_KEY=your_aslan_api_key
OPENAI_API_KEY=your_openai_api_key  # Required for CrewAI agents
```

### 3. Run the Example

```bash
# Python version (recommended)
python crewai_purchase_crew.py

# Node.js version
node crewai-crew.js
```

## 📁 Files in this Directory

- `crewai_purchase_crew.py` - Python CrewAI crew with payment specialists
- `crewai-crew.js` - Node.js version of the purchase crew
- `purchase_tools.py` - Aslan payment tools for CrewAI agents
- `README.md` - This file

## 🎯 What This Example Demonstrates

✅ **Multi-Agent Coordination** - Multiple AI agents working together on purchases  
✅ **Specialized Roles** - Different agents for research, approval, and execution  
✅ **Consensus Building** - Agents collaborate on purchase decisions  
✅ **Risk Management** - Built-in approval workflows and spending controls  
✅ **Delegation** - Agents can delegate tasks to other crew members

## 🔧 Key Features

### Crew Roles Available
- **Purchase Researcher** - Finds best deals and compares options
- **Budget Analyst** - Reviews spending limits and financial impact
- **Purchase Specialist** - Executes approved transactions
- **Compliance Officer** - Ensures purchases meet company policies

### Agent Tools
- `research_vendor` - Research vendors and pricing
- `check_budget` - Analyze budget impact
- `authorize_payment` - Create payment authorization
- `execute_purchase` - Complete the transaction
- `generate_report` - Create purchase summary

### Coordination Patterns
- **Sequential Workflow** - Research → Approve → Execute → Report
- **Consensus Decision** - Multiple agents vote on purchase decisions  
- **Hierarchical Approval** - Budget limits trigger different approval levels
- **Parallel Processing** - Research multiple vendors simultaneously

## 🏗️ Crew Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Purchase        │    │ Budget          │    │ Compliance      │
│ Researcher      │───▶│ Analyst         │───▶│ Officer         │
│                 │    │                 │    │                 │
│ • Find vendors  │    │ • Check limits  │    │ • Policy check  │
│ • Compare prices│    │ • Risk analysis │    │ • Approve/reject│
│ • Get quotes    │    │ • Budget impact │    │ • Audit trail   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────▼───────────────────────┘
                   ┌─────────────────┐
                   │ Purchase        │
                   │ Specialist      │
                   │                 │
                   │ • Execute buy   │
                   │ • Handle errors │
                   │ • Generate proof│
                   └─────────────────┘
```

## 📚 Learn More

- [CrewAI Documentation](https://docs.crewai.com/)
- [CrewAI GitHub Repository](https://github.com/joaomdmoura/crewAI)
- [Aslan API Documentation](https://aslanpay.xyz/docs)

## 🆘 Need Help?

- Check the [main documentation](../../README.md)
- Visit [aslanpay.xyz/docs](https://aslanpay.xyz/docs)
- Create an [issue on GitHub](https://github.com/coltonsakamoto/aslanpay/issues) 