/**
 * SPOTWISE Form Validator
 * Provides real-time validation and feedback for form elements
 */
class UIFormValidator {
    constructor(formElement, options = {}) {
        this.form = formElement;
        this.options = {
            validateOnInput: true,
            validateOnBlur: true,
            showValidFeedback: true,
            animateFeedback: true,
            ...options
        };
        
        this.validators = {
            required: (value) => value.trim() !== '' || 'This field is required',
            email: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || 'Please enter a valid email address',
            phone: (value) => /^\d{10}$/.test(value) || 'Please enter a valid 10-digit phone number',
            password: (value) => value.length >= 8 || 'Password must be at least 8 characters',
            passwordMatch: (value, form) => {
                const password = form.querySelector('input[type="password"]:not([id$="confirm"])');
                return !password || password.value === value || 'Passwords do not match';
            },
            minLength: (value, _form, length) => value.length >= length || `Must be at least ${length} characters`,
            maxLength: (value, _form, length) => value.length <= length || `Cannot exceed ${length} characters`
        };
        
        this.init();
    }
    
    init() {
        if (!this.form) return;
        
        // Add validation attributes to form
        this.form.setAttribute('novalidate', true);
        this.form.classList.add('needs-validation');
        
        // Set up form submit handler
        this.form.addEventListener('submit', this.handleSubmit.bind(this));
        
        // Set up field validation
        const inputs = this.form.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            // Add aria attributes for accessibility
            if (input.hasAttribute('required')) {
                input.setAttribute('aria-required', 'true');
            }
            
            // Attach validation events
            if (this.options.validateOnInput) {
                input.addEventListener('input', () => this.validateField(input));
            }
            
            if (this.options.validateOnBlur) {
                input.addEventListener('blur', () => this.validateField(input));
            }
            
            // Add accessible labels if missing
            const id = input.getAttribute('id');
            if (id) {
                const label = this.form.querySelector(`label[for="${id}"]`);
                if (!label) {
                    const placeholder = input.getAttribute('placeholder');
                    if (placeholder) {
                        input.setAttribute('aria-label', placeholder);
                    }
                }
            } else {
                // Generate ID if missing
                const randomId = `field_${Math.random().toString(36).substring(2, 9)}`;
                input.setAttribute('id', randomId);
                
                const label = input.previousElementSibling;
                if (label && label.tagName === 'LABEL') {
                    label.setAttribute('for', randomId);
                }
            }
        });
    }
    
    validateField(field) {
        // Skip disabled fields
        if (field.disabled) return true;
        
        // Get the field value
        const value = field.type === 'checkbox' ? field.checked : field.value;
        const validations = this.getFieldValidations(field);
        
        // Remove previous feedback
        this.removeFeedback(field);
        
        // Apply validations
        for (const [validationType, params] of validations) {
            const validator = this.validators[validationType];
            if (!validator) continue;
            
            const result = validator(value, this.form, ...params);
            
            // If validation failed (result is a string error message)
            if (typeof result === 'string') {
                this.showError(field, result);
                return false;
            }
        }
        
        // Field is valid
        if (this.options.showValidFeedback) {
            this.showSuccess(field);
        }
        
        return true;
    }
    
    getFieldValidations(field) {
        const validations = [];
        
        // Check for required
        if (field.hasAttribute('required')) {
            validations.push(['required', []]);
        }
        
        // Check type-specific validations
        if (field.type === 'email') {
            validations.push(['email', []]);
        }
        
        if (field.type === 'tel') {
            validations.push(['phone', []]);
        }
        
        if (field.type === 'password') {
            validations.push(['password', []]);
            
            // Check if this is a confirmation field
            if (field.id && field.id.includes('confirm')) {
                validations.push(['passwordMatch', []]);
            }
        }
        
        // Check min/max length
        if (field.hasAttribute('minlength')) {
            validations.push(['minLength', [parseInt(field.getAttribute('minlength'))]]);
        }
        
        if (field.hasAttribute('maxlength')) {
            validations.push(['maxLength', [parseInt(field.getAttribute('maxlength'))]]);
        }
        
        // Check for pattern validations
        if (field.hasAttribute('pattern')) {
            const pattern = new RegExp(field.getAttribute('pattern'));
            validations.push([
                'pattern', 
                [(value) => pattern.test(value) || field.getAttribute('title') || 'Invalid format']
            ]);
        }
        
        // Check for data-validate attributes
        if (field.dataset.validate) {
            const customValidations = field.dataset.validate.split(' ');
            for (const v of customValidations) {
                if (this.validators[v]) {
                    validations.push([v, []]);
                }
            }
        }
        
        return validations;
    }
    
    showError(field, message) {
        // Add is-invalid class to the field
        field.classList.add('is-invalid');
        field.classList.remove('is-valid');
        
        // Set aria attributes
        field.setAttribute('aria-invalid', 'true');
        
        // Create or update feedback element
        let feedbackElement = this.getFeedbackElement(field);
        
        if (!feedbackElement) {
            feedbackElement = document.createElement('div');
            feedbackElement.className = 'invalid-feedback validation-message error';
            
            if (this.options.animateFeedback) {
                feedbackElement.classList.add('fade-in');
            }
            
            field.parentNode.appendChild(feedbackElement);
        }
        
        feedbackElement.textContent = message;
        
        // Announce error for screen readers
        this.announceForScreenReader(`Error: ${message}`);
    }
    
    showSuccess(field) {
        // Add is-valid class to the field
        field.classList.add('is-valid');
        field.classList.remove('is-invalid');
        
        // Set aria attributes
        field.setAttribute('aria-invalid', 'false');
        
        // Create or update feedback element if needed
        if (this.options.showValidFeedback) {
            let feedbackElement = this.getFeedbackElement(field, 'valid');
            
            if (!feedbackElement) {
                feedbackElement = document.createElement('div');
                feedbackElement.className = 'valid-feedback validation-message success';
                
                if (this.options.animateFeedback) {
                    feedbackElement.classList.add('fade-in');
                }
                
                field.parentNode.appendChild(feedbackElement);
            }
            
            feedbackElement.textContent = 'Looks good!';
        }
    }
    
    removeFeedback(field) {
        // Remove validation classes
        field.classList.remove('is-invalid', 'is-valid');
        
        // Remove aria attributes
        field.removeAttribute('aria-invalid');
        
        // Remove feedback elements
        const feedback = this.getFeedbackElement(field);
        if (feedback) {
            feedback.remove();
        }
        
        const validFeedback = this.getFeedbackElement(field, 'valid');
        if (validFeedback) {
            validFeedback.remove();
        }
    }
    
    getFeedbackElement(field, type = 'invalid') {
        return field.parentNode.querySelector(type === 'invalid' ? '.invalid-feedback' : '.valid-feedback');
    }
    
    handleSubmit(event) {
        event.preventDefault();
        
        // Validate all fields
        let isValid = true;
        const fields = this.form.querySelectorAll('input, select, textarea');
        
        fields.forEach(field => {
            if (!this.validateField(field)) {
                isValid = false;
            }
        });
        
        // Focus first invalid field
        if (!isValid) {
            const firstInvalidField = this.form.querySelector('.is-invalid');
            if (firstInvalidField) {
                firstInvalidField.focus();
            }
            
            this.announceForScreenReader('Form has errors. Please correct them before submitting.');
            return;
        }
        
        // If all is valid, submit the form
        if (this.options.onSubmit) {
            this.options.onSubmit(this.form);
        } else {
            this.form.removeEventListener('submit', this.handleSubmit);
            this.form.submit();
        }
    }
    
    announceForScreenReader(message) {
        let announcer = document.getElementById('validation-announcer');
        
        if (!announcer) {
            announcer = document.createElement('div');
            announcer.id = 'validation-announcer';
            announcer.setAttribute('aria-live', 'assertive');
            announcer.setAttribute('role', 'status');
            announcer.className = 'sr-only';
            document.body.appendChild(announcer);
        }
        
        announcer.textContent = message;
        
        // Clear after announcement
        setTimeout(() => {
            announcer.textContent = '';
        }, 3000);
    }
    
    addValidator(name, validatorFn) {
        this.validators[name] = validatorFn;
    }
    
    reset() {
        const fields = this.form.querySelectorAll('input, select, textarea');
        fields.forEach(field => {
            this.removeFeedback(field);
        });
        
        this.form.reset();
    }
}

// Initialize form validators on load
document.addEventListener('DOMContentLoaded', () => {
    // Get all forms with the 'validate-form' class
    const forms = document.querySelectorAll('form.validate-form');
    
    forms.forEach(form => {
        form.formValidator = new UIFormValidator(form);
    });
    
    // Export global function for manual initialization
    window.initFormValidator = (formElement, options) => {
        return new UIFormValidator(formElement, options);
    };
});
