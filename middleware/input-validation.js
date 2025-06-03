const Joi = require('joi');

/**
 * Input validation schemas and middleware
 */
class InputValidation {
    // Common validation patterns
    static patterns = {
        email: Joi.string().email().lowercase().trim().max(255),
        password: Joi.string().min(8).max(128),
        name: Joi.string().trim().min(1).max(100),
        apiKeyName: Joi.string().trim().min(1).max(50),
        uuidv4: Joi.string().uuid({ version: 'uuidv4' }),
        amount: Joi.number().positive().max(10000000), // Max $100,000 in cents
        url: Joi.string().uri({ scheme: ['http', 'https'] }),
        phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/), // E.164 format
    };

    // Authentication schemas
    static authSchemas = {
        register: Joi.object({
            email: this.patterns.email.required(),
            password: this.patterns.password.required(),
            name: this.patterns.name.required()
        }),
        
        login: Joi.object({
            email: this.patterns.email.required(),
            password: this.patterns.password.required()
        }),
        
        forgotPassword: Joi.object({
            email: this.patterns.email.required()
        }),
        
        resetPassword: Joi.object({
            token: Joi.string().hex().length(64).required(),
            password: this.patterns.password.required()
        }),
        
        verifyEmail: Joi.object({
            token: Joi.string().hex().length(64).required()
        })
    };

    // API Key schemas
    static apiKeySchemas = {
        create: Joi.object({
            name: this.patterns.apiKeyName.required()
        }),
        
        update: Joi.object({
            name: this.patterns.apiKeyName.required()
        })
    };

    // Payment authorization schemas
    static paymentSchemas = {
        authorize: Joi.object({
            amount: this.patterns.amount.required(),
            description: Joi.string().trim().min(1).max(500).required(),
            merchant: Joi.string().trim().max(100),
            metadata: Joi.object().max(10) // Max 10 metadata fields
        }),
        
        confirm: Joi.object({
            paymentMethodId: Joi.string().alphanum().max(50),
            receiptEmail: this.patterns.email
        }),
        
        refund: Joi.object({
            reason: Joi.string().trim().max(500),
            amount: this.patterns.amount
        })
    };

    // Purchase schemas
    static purchaseSchemas = {
        makePurchase: Joi.object({
            service: Joi.string().valid(
                'sms', 'domain', 'gift-card', 'credits', 
                'vps', 'shopping', 'flight'
            ).required(),
            params: Joi.object().required(),
            agentToken: Joi.string().pattern(/^(ak_live_|ak_test_)[a-zA-Z0-9]{32,}$/).required()
        })
    };

    /**
     * Sanitize input to prevent XSS
     */
    static sanitizeInput(input) {
        if (typeof input === 'string') {
            // Remove script tags and dangerous HTML
            return input
                .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
                .replace(/javascript:/gi, '')
                .replace(/on\w+\s*=/gi, '') // Remove event handlers
                .trim();
        }
        
        if (Array.isArray(input)) {
            return input.map(item => this.sanitizeInput(item));
        }
        
        if (typeof input === 'object' && input !== null) {
            const sanitized = {};
            for (const [key, value] of Object.entries(input)) {
                sanitized[key] = this.sanitizeInput(value);
            }
            return sanitized;
        }
        
        return input;
    }

    /**
     * Validate request body against schema
     */
    static validateBody(schema) {
        return async (req, res, next) => {
            try {
                // Sanitize input first
                req.body = this.sanitizeInput(req.body);
                
                // Validate against schema
                const { error, value } = schema.validate(req.body, {
                    abortEarly: false, // Return all errors
                    stripUnknown: true // Remove unknown fields
                });
                
                if (error) {
                    const errors = error.details.map(detail => ({
                        field: detail.path.join('.'),
                        message: detail.message
                    }));
                    
                    return res.status(400).json({
                        error: 'Validation failed',
                        code: 'VALIDATION_ERROR',
                        errors
                    });
                }
                
                // Replace body with validated and sanitized value
                req.body = value;
                next();
                
            } catch (err) {
                console.error('Validation middleware error:', err);
                res.status(500).json({
                    error: 'Internal validation error',
                    code: 'VALIDATION_SYSTEM_ERROR'
                });
            }
        };
    }

    /**
     * Validate query parameters
     */
    static validateQuery(schema) {
        return async (req, res, next) => {
            try {
                const { error, value } = schema.validate(req.query, {
                    abortEarly: false,
                    stripUnknown: true
                });
                
                if (error) {
                    const errors = error.details.map(detail => ({
                        field: detail.path.join('.'),
                        message: detail.message
                    }));
                    
                    return res.status(400).json({
                        error: 'Query validation failed',
                        code: 'QUERY_VALIDATION_ERROR',
                        errors
                    });
                }
                
                req.query = value;
                next();
                
            } catch (err) {
                console.error('Query validation error:', err);
                res.status(500).json({
                    error: 'Internal validation error',
                    code: 'VALIDATION_SYSTEM_ERROR'
                });
            }
        };
    }

    /**
     * Validate route parameters
     */
    static validateParams(schema) {
        return async (req, res, next) => {
            try {
                const { error, value } = schema.validate(req.params, {
                    abortEarly: false
                });
                
                if (error) {
                    const errors = error.details.map(detail => ({
                        field: detail.path.join('.'),
                        message: detail.message
                    }));
                    
                    return res.status(400).json({
                        error: 'Parameter validation failed',
                        code: 'PARAM_VALIDATION_ERROR',
                        errors
                    });
                }
                
                req.params = value;
                next();
                
            } catch (err) {
                console.error('Param validation error:', err);
                res.status(500).json({
                    error: 'Internal validation error',
                    code: 'VALIDATION_SYSTEM_ERROR'
                });
            }
        };
    }

    /**
     * Custom validators
     */
    static customValidators = {
        // Validate credit card number (basic Luhn check)
        creditCard: (value) => {
            const digits = value.replace(/\D/g, '');
            if (digits.length < 13 || digits.length > 19) {
                return false;
            }
            
            let sum = 0;
            let isEven = false;
            
            for (let i = digits.length - 1; i >= 0; i--) {
                let digit = parseInt(digits[i], 10);
                
                if (isEven) {
                    digit *= 2;
                    if (digit > 9) {
                        digit -= 9;
                    }
                }
                
                sum += digit;
                isEven = !isEven;
            }
            
            return sum % 10 === 0;
        },
        
        // Validate strong password
        strongPassword: (value) => {
            // At least 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special
            const strongRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
            return strongRegex.test(value);
        }
    };
}

module.exports = InputValidation; 