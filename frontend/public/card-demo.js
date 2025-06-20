// Card Management Demo Module
class CardManagementDemo {
    constructor() {
        this.cards = this.loadCards();
        this.selectedCard = this.cards.find(card => card.isDefault) || this.cards[0] || null;
    }
    
    loadCards() {
        const stored = localStorage.getItem('demoCards');
        if (stored) {
            return JSON.parse(stored);
        }
        
        // Default demo cards
        return [
            {
                id: 'card_demo_001',
                last4: '4242',
                brand: 'visa',
                expMonth: 12,
                expYear: 2028,
                isDefault: true,
                nickname: 'Demo Visa Card',
                addedAt: new Date().toISOString(),
                status: 'active'
            }
        ];
    }
    
    saveCards() {
        localStorage.setItem('demoCards', JSON.stringify(this.cards));
    }
    
    // Test card numbers for demo
    getTestCards() {
        return [
            {
                number: '4242424242424242',
                brand: 'visa',
                name: 'Visa Test Card',
                description: 'Always succeeds'
            },
            {
                number: '4000000000000002',
                brand: 'visa',
                name: 'Visa Declined Card',
                description: 'Always declines'
            },
            {
                number: '5555555555554444',
                brand: 'mastercard',
                name: 'Mastercard Test Card',
                description: 'Always succeeds'
            },
            {
                number: '378282246310005',
                brand: 'amex',
                name: 'American Express',
                description: 'Always succeeds'
            },
            {
                number: '4000000000000119',
                brand: 'visa',
                name: 'Processing Error Card',
                description: 'Simulates processing error'
            }
        ];
    }
    
    addCard(cardData) {
        const newCard = {
            id: `card_demo_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            last4: cardData.number.slice(-4),
            brand: cardData.brand,
            expMonth: cardData.expMonth,
            expYear: cardData.expYear,
            nickname: cardData.nickname || `${cardData.brand.toUpperCase()} •••• ${cardData.number.slice(-4)}`,
            isDefault: this.cards.length === 0, // First card becomes default
            addedAt: new Date().toISOString(),
            status: 'active'
        };
        
        this.cards.push(newCard);
        this.saveCards();
        
        if (newCard.isDefault) {
            this.selectedCard = newCard;
        }
        
        return newCard;
    }
    
    removeCard(cardId) {
        const cardIndex = this.cards.findIndex(card => card.id === cardId);
        if (cardIndex === -1) return false;
        
        const wasDefault = this.cards[cardIndex].isDefault;
        this.cards.splice(cardIndex, 1);
        
        // If we removed the default card, make another one default
        if (wasDefault && this.cards.length > 0) {
            this.cards[0].isDefault = true;
            this.selectedCard = this.cards[0];
        } else if (this.cards.length === 0) {
            this.selectedCard = null;
        }
        
        this.saveCards();
        return true;
    }
    
    setDefaultCard(cardId) {
        // Remove default from all cards
        this.cards.forEach(card => card.isDefault = false);
        
        // Set new default
        const card = this.cards.find(card => card.id === cardId);
        if (card) {
            card.isDefault = true;
            this.selectedCard = card;
            this.saveCards();
            return true;
        }
        return false;
    }
    
    getSelectedCard() {
        return this.selectedCard;
    }
    
    getAllCards() {
        return this.cards;
    }
    
    validateCardNumber(number) {
        // Remove spaces and non-digits
        const cleaned = number.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
        
        // Check length
        if (cleaned.length < 13 || cleaned.length > 19) {
            return { valid: false, error: 'Invalid card number length' };
        }
        
        // Luhn algorithm check
        let sum = 0;
        let isEven = false;
        
        for (let i = cleaned.length - 1; i >= 0; i--) {
            let digit = parseInt(cleaned.charAt(i));
            
            if (isEven) {
                digit *= 2;
                if (digit > 9) {
                    digit -= 9;
                }
            }
            
            sum += digit;
            isEven = !isEven;
        }
        
        if (sum % 10 !== 0) {
            return { valid: false, error: 'Invalid card number' };
        }
        
        // Determine brand
        let brand = 'unknown';
        if (/^4/.test(cleaned)) brand = 'visa';
        else if (/^5[1-5]/.test(cleaned)) brand = 'mastercard';
        else if (/^3[47]/.test(cleaned)) brand = 'amex';
        else if (/^6/.test(cleaned)) brand = 'discover';
        
        return { valid: true, brand, cleaned };
    }
    
    simulateCardAdding(cardNumber, expMonth, expYear, cvc, nickname) {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                const validation = this.validateCardNumber(cardNumber);
                
                if (!validation.valid) {
                    reject(new Error(validation.error));
                    return;
                }
                
                // Simulate different scenarios based on card number
                if (cardNumber.includes('0000000000000002')) {
                    reject(new Error('Card was declined by your bank'));
                    return;
                }
                
                if (cardNumber.includes('0000000000000119')) {
                    reject(new Error('Processing error - please try again'));
                    return;
                }
                
                // Success - add the card
                const newCard = this.addCard({
                    number: validation.cleaned,
                    brand: validation.brand,
                    expMonth: parseInt(expMonth),
                    expYear: parseInt(expYear),
                    nickname: nickname
                });
                
                resolve(newCard);
            }, 1500); // Simulate API call delay
        });
    }
}

// Payment Processing Demo
class PaymentProcessingDemo {
    constructor(cardManager) {
        this.cardManager = cardManager;
    }
    
    processPayment(amount, service, cardId = null) {
        return new Promise((resolve, reject) => {
            const card = cardId ? 
                this.cardManager.getAllCards().find(c => c.id === cardId) : 
                this.cardManager.getSelectedCard();
                
            if (!card) {
                reject(new Error('No payment method available'));
                return;
            }
            
            setTimeout(() => {
                // Simulate different outcomes based on card
                if (card.last4 === '0002') {
                    reject(new Error('Payment declined - insufficient funds'));
                    return;
                }
                
                if (card.last4 === '0119') {
                    reject(new Error('Payment processing error'));
                    return;
                }
                
                // Success
                resolve({
                    success: true,
                    transactionId: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
                    amount: amount,
                    service: service,
                    card: {
                        last4: card.last4,
                        brand: card.brand
                    },
                    processingTime: Math.random() * 200 + 100 // 100-300ms
                });
            }, Math.random() * 800 + 500); // 500-1300ms processing time
        });
    }
}

// Export for global use
window.CardManagementDemo = CardManagementDemo;
window.PaymentProcessingDemo = PaymentProcessingDemo; 