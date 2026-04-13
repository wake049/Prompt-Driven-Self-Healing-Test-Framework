package demo;

import org.apache.http.client.config.RequestConfig;
import org.apache.http.impl.client.CloseableHttpClient;
import org.apache.http.impl.client.HttpClients;

/**
 * Factory for creating HTTP clients with proper timeout configuration.
 * Prevents indefinite hangs from missing timeouts (MED-003).
 */
public class HttpClientFactory {

    private static final int CONNECT_TIMEOUT_MS = 10_000;
    private static final int SOCKET_TIMEOUT_MS = 30_000;
    private static final int CONNECTION_REQUEST_TIMEOUT_MS = 5_000;

    private static final RequestConfig DEFAULT_CONFIG = RequestConfig.custom()
            .setConnectTimeout(CONNECT_TIMEOUT_MS)
            .setSocketTimeout(SOCKET_TIMEOUT_MS)
            .setConnectionRequestTimeout(CONNECTION_REQUEST_TIMEOUT_MS)
            .build();

    public static CloseableHttpClient create() {
        return HttpClients.custom()
                .setDefaultRequestConfig(DEFAULT_CONFIG)
                .build();
    }
}
