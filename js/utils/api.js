import { auth } from '../auth.js';

/**
 * Authenticated fetch wrapper
 */
export async function apiFetch(endpoint, options = {}) {
    const token = auth.getToken();
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(endpoint, {
        ...options,
        headers
    });

    if (response.status === 401) {
        auth.logout();
        return;
    }

    return response;
}

/**
 * Form data fetch wrapper (for file uploads)
 */
export async function apiUpload(endpoint, formData) {
    const token = auth.getToken();
    
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`
        },
        body: formData
    });

    if (response.status === 401) {
        auth.logout();
        return;
    }

    return response;
}
