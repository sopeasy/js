# Peasy Analytics Script

A lightweight, privacy-focused analytics script for websites. This is the standalone JavaScript version that can be included directly in your HTML without any build tools or package managers.

## Quick Start

Add the following script tag to your HTML:

```html
<script
    src="https://cdn.peasy.so/script.js"
    data-website-id="your-website-id"
    async
></script>
```

That's it! Page views will be tracked automatically.

## Configuration

The script can be configured using data attributes:

```html
<script
    src="https://cdn.peasy.so/script.js"
    data-website-id="your-website-id"
    data-ingest-url="https://your-custom-ingest-url.com/v1/ingest/"
    data-mask-patterns="/customer/*,/user/*"
    data-auto-page-view="true"
    data-ignore-query-params="false"
    async
></script>
```

### Available Options

- `data-website-id` (required): Your website ID from the Peasy dashboard
- `data-ingest-url` (optional): Custom ingest host (default: 'https://api.peasy.so/v1/ingest/')
- `data-mask-patterns` (optional): Comma-separated list of patterns to mask in URL tracking
- `data-auto-page-view` (optional): Enable/disable automatic page view tracking (default: true)
- `data-ignore-query-params` (optional): Ignore query parameters in tracked URLs (default: false)

## Usage

### Automatic Page View Tracking

By default, Peasy automatically tracks page views. This includes both initial page loads and client-side navigation in single-page applications.

### Manual Page View Tracking

If you've disabled automatic page view tracking (`data-auto-page-view="false"`), you can manually track page views:

```javascript
window.peasy.page();
```

### Custom Event Tracking

Track custom events with optional metadata:

```javascript
window.peasy.track('button_click', {
    button_id: 'signup',
    location: 'header'
});

window.peasy.track('purchase_completed', {
    order_id: '123',
    total: 99.99,
    currency: 'USD'
});
```

### User Profile Management

Set user profiles to enrich your analytics data:

```javascript
window.peasy.setProfile('user123', {
    $name: 'John Doe',
    $avatar: 'https://example.com/avatar.png',
    age: 30,
    plan: 'premium'
});
```

Note: `$name` and `$avatar` are reserved keys that will be displayed in the Peasy dashboard.

### URL Masking

Protect sensitive information in URLs by configuring mask patterns:

```html
<script
    src="https://cdn.peasy.so/script.js"
    data-website-id="your-website-id"
    data-mask-patterns="/user/*,/customer/*"
    async
></script>
```

This will mask URLs like:
- `/user/123` → `/user/*`
- `/customer/456` → `/customer/*`

### Form Tracking

Peasy can automatically track form submissions with detailed field data:

```html
<form 
    data-peasy-event="signup_form_submit"
    data-peasy-event-form_type="newsletter"
>
    <!-- All form fields will be tracked except:
         - Password fields
         - Fields with data-peasy-ignore
         - Empty fields
    -->
    <input type="email" name="email" />
    <input type="text" name="name" />
    <input type="password" name="password" />
    <input type="text" name="sensitive" data-peasy-ignore />
    <button type="submit">Submit</button>
</form>
```

The form submission event will include:
- All non-empty field values (except passwords and ignored fields)
- The form's action URL
- Any additional data-peasy-event-* attributes
- Checkbox and radio button states


### Click Tracking

Track element clicks with custom metadata:

```html
<!-- Simple button tracking -->
<button data-peasy-event="login_click">
    Log In
</button>

<!-- With dynamic attributes -->
<button 
    data-peasy-event="purchase_click"
    data-peasy-event-product_id="123"
    data-peasy-event-price="99.99"
    data-peasy-event-currency="USD"
>
    Buy Now
</button>
```

## License

MIT License - see [LICENSE](LICENSE) for details
