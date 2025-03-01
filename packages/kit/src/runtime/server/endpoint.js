import { HttpError, Redirect } from '../control.js';
import { check_method_names, method_not_allowed } from './utils.js';

/**
 * @param {import('types').RequestEvent} event
 * @param {import('types').SSREndpoint} mod
 * @param {import('types').SSRState} state
 * @returns {Promise<Response>}
 */
export async function render_endpoint(event, mod, state) {
	const method = /** @type {import('types').HttpMethod} */ (event.request.method);

	// TODO: Remove for 1.0
	check_method_names(mod);

	let handler = mod[method];

	if (!handler && method === 'HEAD') {
		handler = mod.GET;
	}

	if (!handler) {
		return method_not_allowed(mod, method);
	}

	const prerender = mod.prerender ?? state.prerender_default;

	if (prerender && (mod.POST || mod.PATCH || mod.PUT || mod.DELETE)) {
		throw new Error('Cannot prerender endpoints that have mutative methods');
	}

	if (state.prerendering && !prerender) {
		throw new Error(`${event.routeId} is not prerenderable`);
	}

	try {
		const response = await handler(
			/** @type {import('types').RequestEvent<Record<string, any>>} */ (event)
		);

		if (!(response instanceof Response)) {
			return new Response(
				`Invalid response from route ${event.url.pathname}: handler should return a Response object`,
				{ status: 500 }
			);
		}

		if (state.prerendering) {
			response.headers.set('x-sveltekit-routeid', /** @type {string} */ (event.routeId));
			response.headers.set('x-sveltekit-prerender', String(prerender));
		}

		return response;
	} catch (error) {
		if (error instanceof HttpError) {
			return new Response(error.message, { status: error.status });
		} else if (error instanceof Redirect) {
			return new Response(undefined, {
				status: error.status,
				headers: { Location: error.location }
			});
		} else {
			throw error;
		}
	}
}
