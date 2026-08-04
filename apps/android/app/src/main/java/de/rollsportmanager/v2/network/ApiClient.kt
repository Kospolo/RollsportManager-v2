package de.rollsportmanager.v2.network

import de.rollsportmanager.contracts.Problem
import java.io.IOException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

/**
 * Fehler des API-Clients. Die API antwortet bei Fehlern mit RFC 7807
 * `application/problem+json` (Schema `Problem` aus den generierten
 * Contracts) — inklusive `request_id` für Log-Korrelation.
 */
sealed class ApiException(message: String, cause: Throwable? = null) :
    Exception(message, cause) {

    /** Der Server hat ein RFC-7807-Problem geliefert (4xx/5xx mit Body). */
    class ProblemResponse(val problem: Problem) : ApiException(
        buildString {
            append("${problem.title} (${problem.status})")
            problem.detail?.let { append(": $it") }
        },
    )

    /** Nicht-2xx-Status ohne parsebaren Problem-Body. */
    class UnexpectedStatus(val code: Int) : ApiException("Unerwarteter HTTP-Status $code")

    /** Transport-/Verbindungsfehler (z. B. Dev-Stack läuft nicht). */
    class Transport(cause: IOException) : ApiException(
        cause.message ?: "Verbindungsfehler",
        cause,
    )

    /** Antwort war kein dekodierbares JSON des erwarteten Typs. */
    class Decoding(cause: Throwable) : ApiException(
        "Antwort nicht lesbar: ${cause.message}",
        cause,
    )
}

/**
 * Schlanker OkHttp-Client (suspend, Dispatchers.IO) für den lokalen Dev-Stack.
 *
 * - Bearer-Token kommt pro Request aus dem `tokenProvider` (SessionStore),
 *   damit der Client selbst zustandslos bleibt.
 * - Kein Retrofit o. Ä. — nur OkHttp + kotlinx.serialization (Blueprint-Regel).
 * - Alle Pfade/Typen kommen aus `Endpoints.kt` + generierten Contracts.
 */
class ApiClient(
    private val baseUrl: String = DevConfig.DEFAULT_BASE_URL,
    /** Liefert das aktuelle Bearer-Token; `null` = anonym (nur /dev/login, /health). */
    private val tokenProvider: () -> String? = { null },
) {
    private val http = OkHttpClient()

    // Contracts lassen Timestamps/UUIDs bewusst als String auf der Leitung —
    // keine Custom-Serializer nötig (siehe RsmContracts.kt Kopf).
    val json: Json = Json { ignoreUnknownKeys = true }

    // Öffentliche Verben — reified, damit Endpoints.kt typisiert bleibt.

    suspend inline fun <reified R> get(path: String, query: Map<String, String> = emptyMap()): R =
        json.decodeFromString(execute("GET", path, query, null))

    suspend inline fun <reified B, reified R> post(path: String, body: B): R =
        json.decodeFromString(execute("POST", path, emptyMap(), json.encodeToString(body)))

    suspend inline fun <reified B, reified R> put(path: String, body: B): R =
        json.decodeFromString(execute("PUT", path, emptyMap(), json.encodeToString(body)))

    suspend inline fun <reified B, reified R> patch(path: String, body: B): R =
        json.decodeFromString(execute("PATCH", path, emptyMap(), json.encodeToString(body)))

    /**
     * Kern: führt den Request aus und liefert den Body als String; wirft
     * ApiException (Problem/UnexpectedStatus/Transport). Das Dekodieren des
     * Erfolgs-Bodys machen die reified-Wrapper oben — Decoding-Fehler dort
     * kommen als SerializationException an und werden hier NICHT maskiert;
     * Feature-Code fängt beides über `runCatching`/try.
     */
    @PublishedApi
    internal suspend fun execute(
        method: String,
        path: String,
        query: Map<String, String>,
        jsonBody: String?,
    ): String = withContext(Dispatchers.IO) {
        val url = baseUrl.toHttpUrl().newBuilder().apply {
            addPathSegments(path.trimStart('/'))
            query.forEach { (k, v) -> addQueryParameter(k, v) }
        }.build()

        val request = Request.Builder()
            .url(url)
            .header("Accept", "application/json")
            .apply {
                tokenProvider()?.let { header("Authorization", "Bearer $it") }
            }
            .method(method, jsonBody?.toRequestBody(JSON_MEDIA_TYPE))
            .build()

        val response = try {
            http.newCall(request).execute()
        } catch (e: IOException) {
            throw ApiException.Transport(e)
        }

        response.use {
            val bodyText = it.body?.string().orEmpty()
            if (!it.isSuccessful) {
                // RFC 7807: Fehler-Body als Problem dekodieren, wenn möglich.
                val problem = runCatching {
                    json.decodeFromString<Problem>(bodyText)
                }.getOrNull()
                if (problem != null) throw ApiException.ProblemResponse(problem)
                throw ApiException.UnexpectedStatus(it.code)
            }
            bodyText
        }
    }

    companion object {
        @PublishedApi
        internal val JSON_MEDIA_TYPE = "application/json; charset=utf-8".toMediaType()
    }
}
