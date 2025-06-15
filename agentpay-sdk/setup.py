#!/usr/bin/env python3

from setuptools import setup, find_packages
import os

# Read README for long description
def read_readme():
    with open("README.md", "r", encoding="utf-8") as f:
        return f.read()

# Read version from __init__.py
def read_version():
    with open("agentpay/__init__.py", "r") as f:
        for line in f:
            if line.startswith("__version__"):
                return line.split("=")[1].strip().strip('"').strip("'")
    return "0.1.0"

setup(
    name="agentpay",
    version=read_version(),
    author="AgentPay",
    author_email="hello@agentpay.org",
    description="Dead simple AI agent payments - 5 lines to add purchasing power to any AI",
    long_description=read_readme(),
    long_description_content_type="text/markdown",
    url="https://github.com/agentpay/agentpay-python",
    project_urls={
        "Homepage": "https://agentpay.org",
        "Documentation": "https://docs.agentpay.org",
        "Source": "https://github.com/agentpay/agentpay-python",
        "Tracker": "https://github.com/agentpay/agentpay-python/issues",
    },
    packages=find_packages(),
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.7",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
        "Topic :: Software Development :: Libraries :: Python Modules",
        "Topic :: Internet :: WWW/HTTP",
        "Topic :: Office/Business :: Financial :: Point-Of-Sale",
        "Topic :: Scientific/Engineering :: Artificial Intelligence",
    ],
    keywords="ai, agent, payment, gpt, chatgpt, langchain, autogpt, purchasing, ecommerce",
    python_requires=">=3.7",
    install_requires=[
        "requests>=2.25.0",
    ],
    extras_require={
        "dev": [
            "pytest>=6.0",
            "pytest-cov",
            "black",
            "isort",
            "mypy",
            "flake8",
        ],
        "async": [
            "aiohttp>=3.7.0",
        ],
    },
    include_package_data=True,
    zip_safe=False,
) 