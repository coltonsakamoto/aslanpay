#!/bin/bash

# 🦁 Aslan Favicon Setup Script
# This script helps set up the complete favicon package for Aslan

echo "🦁 Aslan Favicon Setup"
echo "====================="
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Run this script from the project root directory"
    exit 1
fi

# Check if public directory exists
if [ ! -d "public" ]; then
    echo "❌ Error: public directory not found"
    exit 1
fi

echo "📂 Current favicon files in public/:"
ls -la public/favicon* public/apple-touch* public/android-chrome* public/site.webmanifest 2>/dev/null || echo "   No favicon files found yet"
echo ""

echo "✅ The following files are already set up:"
echo "   • favicon.svg (modern SVG favicon)"
echo "   • site.webmanifest (PWA manifest)"
echo "   • HTML meta tags in main pages"
echo ""

echo "⚠️  Still needed:"
echo "   • favicon.ico (legacy support)"
echo "   • favicon-16x16.png"
echo "   • favicon-32x32.png" 
echo "   • apple-touch-icon.png (180x180)"
echo "   • android-chrome-192x192.png"
echo "   • android-chrome-512x512.png"
echo ""

echo "📋 Choose an option:"
echo "   1) Download from Favicon.io (recommended)"
echo "   2) Use built-in generator"
echo "   3) Manual instructions"
echo "   4) Test current setup"
echo ""

read -p "Enter your choice (1-4): " choice

case $choice in
    1)
        echo ""
        echo "🌐 Opening Favicon.io lion emoji page..."
        echo "   1. The page will open in your browser"
        echo "   2. Click 'Download' to get the favicon package"
        echo "   3. Extract the files to the public/ directory"
        echo "   4. Run this script again with option 4 to test"
        echo ""
        
        # Try to open the favicon.io page
        if command -v open &> /dev/null; then
            open "https://favicon.io/emoji-favicons/lion/"
        elif command -v xdg-open &> /dev/null; then
            xdg-open "https://favicon.io/emoji-favicons/lion/"
        else
            echo "   Manual: https://favicon.io/emoji-favicons/lion/"
        fi
        ;;
        
    2)
        echo ""
        echo "🛠️  Starting built-in generator..."
        echo "   1. Starting the server..."
        
        # Check if server is already running
        if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null ; then
            echo "   ✅ Server already running on port 3000"
        else
            echo "   🚀 Starting server..."
            npm start &
            SERVER_PID=$!
            sleep 3
        fi
        
        echo "   2. Opening favicon generator..."
        if command -v open &> /dev/null; then
            open "http://localhost:3000/favicon-generator"
        elif command -v xdg-open &> /dev/null; then
            xdg-open "http://localhost:3000/favicon-generator"
        else
            echo "   Manual: http://localhost:3000/favicon-generator"
        fi
        
        echo "   3. Use the generator to download PNG files"
        echo "   4. Save them in the public/ directory"
        ;;
        
    3)
        echo ""
        echo "📝 Manual Setup Instructions:"
        echo ""
        echo "Create these files in the public/ directory:"
        echo "   • favicon.ico (16x16 or 32x32, .ico format)"
        echo "   • favicon-16x16.png (16×16 pixels)"
        echo "   • favicon-32x32.png (32×32 pixels)"
        echo "   • apple-touch-icon.png (180×180 pixels)"
        echo "   • android-chrome-192x192.png (192×192 pixels)"
        echo "   • android-chrome-512x512.png (512×512 pixels)"
        echo ""
        echo "Design specs:"
        echo "   • Background: Orange circle (#FF6B35)"
        echo "   • Icon: White lion emoji 🦁"
        echo "   • Format: PNG (except favicon.ico)"
        echo ""
        echo "Tools you can use:"
        echo "   • https://favicon.io/emoji-favicons/lion/"
        echo "   • https://realfavicongenerator.net/"
        echo "   • https://www.favicongenerator.com/"
        echo "   • Any image editor (Photoshop, GIMP, etc.)"
        ;;
        
    4)
        echo ""
        echo "🧪 Testing current favicon setup..."
        echo ""
        
        # Check for required files
        files=(
            "favicon.svg"
            "favicon.ico" 
            "favicon-16x16.png"
            "favicon-32x32.png"
            "apple-touch-icon.png"
            "android-chrome-192x192.png"
            "android-chrome-512x512.png"
            "site.webmanifest"
        )
        
        missing_files=()
        
        for file in "${files[@]}"; do
            if [ -f "public/$file" ]; then
                echo "   ✅ $file"
            else
                echo "   ❌ $file (missing)"
                missing_files+=("$file")
            fi
        done
        
        echo ""
        
        if [ ${#missing_files[@]} -eq 0 ]; then
            echo "🎉 All favicon files are present!"
            echo ""
            echo "Next steps:"
            echo "   1. Start the server: npm start"
            echo "   2. Visit http://localhost:3000"
            echo "   3. Check browser tab for lion icon"
            echo "   4. Test on mobile devices"
        else
            echo "⚠️  Missing ${#missing_files[@]} file(s). Run options 1-3 to complete setup."
        fi
        ;;
        
    *)
        echo "❌ Invalid choice. Please run the script again."
        exit 1
        ;;
esac

echo ""
echo "📚 For more details, see: public/FAVICON_README.md"
echo "🦁 Aslan favicon setup complete!" 