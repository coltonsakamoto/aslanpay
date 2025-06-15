#!/bin/bash

# 📦 AgentPay NPM Publishing Script
# Publishes the AgentPay SDK to NPM registry

set -e

echo "📦 AgentPay NPM Publishing Starting..."

# Check if logged into NPM
if ! npm whoami > /dev/null 2>&1; then
  echo "❌ Not logged into NPM. Please run 'npm login' first."
  exit 1
fi

NPM_USER=$(npm whoami)
echo "👤 NPM User: $NPM_USER"

# Verify we're in the right directory
if [ ! -f "package.json" ]; then
  echo "❌ No package.json found. Are you in the right directory?"
  exit 1
fi

# Get package info
PACKAGE_NAME=$(node -p "require('./package.json').name")
PACKAGE_VERSION=$(node -p "require('./package.json').version")

echo "📋 Package: $PACKAGE_NAME@$PACKAGE_VERSION"

# Check if version already exists
if npm view $PACKAGE_NAME@$PACKAGE_VERSION version > /dev/null 2>&1; then
  echo "❌ Version $PACKAGE_VERSION already exists on NPM!"
  echo "💡 Update the version in package.json and try again:"
  echo "   npm version patch   # 2.0.0 -> 2.0.1"
  echo "   npm version minor   # 2.0.0 -> 2.1.0"
  echo "   npm version major   # 2.0.0 -> 3.0.0"
  exit 1
fi

# Clean and build
echo "🧹 Cleaning previous builds..."
rm -rf dist/

echo "📦 Building TypeScript..."
npm run build

# Verify build output
if [ ! -d "dist" ]; then
  echo "❌ Build failed - no dist directory found"
  exit 1
fi

if [ ! -f "dist/index.js" ]; then
  echo "❌ Build failed - no index.js found in dist"
  exit 1
fi

if [ ! -f "dist/index.d.ts" ]; then
  echo "❌ Build failed - no type definitions found"
  exit 1
fi

echo "✅ Build successful!"

# Run tests if they exist
if [ -f "package.json" ] && grep -q '"test"' package.json; then
  echo "🧪 Running tests..."
  npm test
  echo "✅ Tests passed!"
fi

# Show what will be published
echo ""
echo "📋 Files to be published:"
npm pack --dry-run

# Confirm publication
echo ""
echo "🚀 Ready to publish $PACKAGE_NAME@$PACKAGE_VERSION"
echo ""
read -p "❓ Continue with publication? (y/N): " -n 1 -r
echo

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "❌ Publication cancelled"
  exit 1
fi

# Publish to NPM
echo "🚀 Publishing to NPM..."

if [[ $PACKAGE_VERSION == *"beta"* ]] || [[ $PACKAGE_VERSION == *"alpha"* ]]; then
  echo "📦 Publishing as beta/alpha version..."
  npm publish --tag beta
else
  echo "📦 Publishing as latest version..."
  npm publish
fi

echo ""
echo "🎉 Successfully published $PACKAGE_NAME@$PACKAGE_VERSION!"
echo ""
echo "📝 Next steps:"
echo "   1. 🏷️ Create Git tag: git tag v$PACKAGE_VERSION && git push --tags"
echo "   2. 📝 Update CHANGELOG.md with release notes"
echo "   3. 🐙 Create GitHub release with examples"
echo "   4. 📢 Announce on social media"
echo ""
echo "💡 Installation command for users:"
echo "   npm install $PACKAGE_NAME"
echo ""
echo "🔗 Package URL: https://www.npmjs.com/package/$PACKAGE_NAME" 