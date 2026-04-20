/**
 * Execute a Supabase query safely and normalize the response shape.
 * @param {Promise<{data: any, error: any}>} query
 * @param {Object} [options]
 * @param {any} [options.fallbackData=null]
 * @returns {Promise<{data: any, error: any}>}
 */
export const safeQuery = async (query, { fallbackData = null } = {}) => {
  try {
    const { data, error } = await query

    if (error) {
      return {
        data: data ?? fallbackData,
        error
      }
    }

    return {
      data: data ?? fallbackData,
      error: null
    }
  } catch (error) {
    return {
      data: fallbackData,
      error
    }
  }
}
