/**
 * @file sim_net.c
 * @brief Embedded Web Server & WebSocket handler for ECU Simulator.
 * 
 * Part of the ECU Simulator Node implementation (Phase 4).
 */

#include "sdkconfig.h"
#include "sim_net.h"
#include "sim_state.h"
#include "sim_io_outputs.h"
#include "index_html.h"

#include "esp_wifi.h"
#include "esp_netif.h"
#include "esp_event.h"
#include "nvs_flash.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "esp_log.h"
#include "esp_http_server.h"
#include "cJSON.h"

static const char *TAG = "SIM_NET";
static httpd_handle_t server = NULL;

typedef struct {
    size_t len;
    char data[];
} sim_ws_payload_t;

/**
 * @brief Initialize WiFi in SoftAP (Access Point) mode.
 */
static void sim_wifi_init(void) {
    esp_err_t ret = nvs_flash_init();
    if (ret == ESP_ERR_NVS_NO_FREE_PAGES || ret == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        ESP_ERROR_CHECK(nvs_flash_erase());
        ret = nvs_flash_init();
    }
    ESP_ERROR_CHECK(ret);

    ESP_LOGI(TAG, "Initializing WiFi SoftAP...");
    ESP_ERROR_CHECK(esp_netif_init());
    ESP_ERROR_CHECK(esp_event_loop_create_default());
    esp_netif_create_default_wifi_ap();

    wifi_init_config_t cfg = WIFI_INIT_CONFIG_DEFAULT();
    ESP_ERROR_CHECK(esp_wifi_init(&cfg));

    wifi_config_t wifi_config = {
        .ap = {
            .ssid = "ESP32S2_ECU_SIM",
            .ssid_len = strlen("ESP32S2_ECU_SIM"),
            .channel = 1,
            .password = "12345678",
            .max_connection = 4,
            .authmode = WIFI_AUTH_WPA2_PSK,
            .pmf_cfg = {
                .required = true,
            },
        },
    };

    ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_AP));
    ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_AP, &wifi_config));
    ESP_ERROR_CHECK(esp_wifi_start());

    ESP_LOGI(TAG, "SoftAP initialized. SSID: %s, Password: %s", wifi_config.ap.ssid, wifi_config.ap.password);
}


/**
 * @brief Parse and execute incoming WebSocket control command.
 */
static void sim_net_handle_command(const char *payload, size_t len) {
    cJSON *root = cJSON_ParseWithLength(payload, len);
    if (!root) {
        ESP_LOGW(TAG, "Failed to parse incoming JSON command: %.*s", (int)len, payload);
        return;
    }
    
    cJSON *cmd_item = cJSON_GetObjectItem(root, "cmd");
    if (cmd_item && cJSON_IsString(cmd_item)) {
        const char *cmd = cmd_item->valuestring;
        
        if (strcmp(cmd, "toggle_override") == 0) {
            cJSON *param_item = cJSON_GetObjectItem(root, "param");
            cJSON *active_item = cJSON_GetObjectItem(root, "active");
            if (param_item && cJSON_IsString(param_item) && active_item && cJSON_IsBool(active_item)) {
                const char *param = param_item->valuestring;
                bool active = cJSON_IsTrue(active_item);
                
                if (strcmp(param, "tps") == 0) {
                    g_sim_state.tps.is_overridden = active;
                } else if (strcmp(param, "egt") == 0) {
                    g_sim_state.egt.is_overridden = active;
                } else if (strcmp(param, "rpm") == 0) {
                    g_sim_state.rpm.is_overridden = active;
                }
                ESP_LOGI(TAG, "Command toggle_override: param=%s active=%d", param, active);
            }
        }
        else if (strcmp(cmd, "set_value") == 0) {
            cJSON *param_item = cJSON_GetObjectItem(root, "param");
            cJSON *value_item = cJSON_GetObjectItem(root, "value");
            if (param_item && cJSON_IsString(param_item) && value_item && cJSON_IsNumber(value_item)) {
                const char *param = param_item->valuestring;
                float value = (float)value_item->valuedouble;
                
                if (strcmp(param, "tps") == 0) {
                    g_sim_state.tps.virtual_val = value;
                } else if (strcmp(param, "egt") == 0) {
                    g_sim_state.egt.virtual_val = value;
                } else if (strcmp(param, "rpm") == 0) {
                    g_sim_state.rpm.virtual_val = value;
                }
                ESP_LOGI(TAG, "Command set_value: param=%s value=%.2f", param, value);
            }
        }
        else if (strcmp(cmd, "inject_fault") == 0) {
            cJSON *fault_item = cJSON_GetObjectItem(root, "fault");
            cJSON *active_item = cJSON_GetObjectItem(root, "active");
            if (fault_item && cJSON_IsString(fault_item) && active_item && cJSON_IsBool(active_item)) {
                const char *fault = fault_item->valuestring;
                bool active = cJSON_IsTrue(active_item);
                
                if (strcmp(fault, "egt_overheat") == 0) {
                    g_sim_state.fault_egt_overheat = active;
                }
                ESP_LOGI(TAG, "Command inject_fault: fault=%s active=%d", fault, active);
            }
        }
        else if (strcmp(cmd, "qs_trigger") == 0) {
            sim_io_qs_trigger();
            ESP_LOGI(TAG, "Command qs_trigger executed");
        }
        else {
            ESP_LOGW(TAG, "Unknown JSON command received: %s", cmd);
        }
    } else {
        ESP_LOGW(TAG, "Invalid WebSocket frame - missing 'cmd' field");
    }
    
    cJSON_Delete(root);
}

/**
 * @brief Handler for GET / (serves inlined compressed dashboard HTML).
 */
static esp_err_t index_get_handler(httpd_req_t *req) {
    httpd_resp_set_type(req, "text/html");
    httpd_resp_set_hdr(req, "Content-Encoding", "gzip");
    httpd_resp_set_hdr(req, "Cache-Control", "no-store");
    return httpd_resp_send(req, (const char *)index_html_gz, index_html_gz_len);
}

/**
 * @brief Handler for GET /favicon.ico.
 */
static esp_err_t favicon_get_handler(httpd_req_t *req) {
    httpd_resp_set_status(req, HTTPD_204);
    return httpd_resp_send(req, NULL, 0);
}

/**
 * @brief Handler for WS /ws (WebSocket endpoint).
 */
static esp_err_t ws_handler(httpd_req_t *req) {
    if (req->method == HTTP_GET) {
        ESP_LOGI(TAG, "Handshake completed, new WS client connected");
        return ESP_OK;
    }
    
    httpd_ws_frame_t ws_pkt;
    uint8_t *buf = NULL;
    memset(&ws_pkt, 0, sizeof(httpd_ws_frame_t));
    ws_pkt.type = HTTPD_WS_TYPE_TEXT;
    
    // Determine payload size
    esp_err_t ret = httpd_ws_recv_frame(req, &ws_pkt, 0);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to get WS frame length: %d", ret);
        return ret;
    }
    
    if (ws_pkt.len > 0) {
        buf = calloc(1, ws_pkt.len + 1);
        if (buf == NULL) {
            ESP_LOGE(TAG, "Failed to allocate memory for WS payload");
            return ESP_ERR_NO_MEM;
        }
        ws_pkt.payload = buf;
        ret = httpd_ws_recv_frame(req, &ws_pkt, ws_pkt.len);
        if (ret != ESP_OK) {
            ESP_LOGE(TAG, "Failed to receive WS frame: %d", ret);
            free(buf);
            return ret;
        }
        
        if (ws_pkt.type == HTTPD_WS_TYPE_TEXT) {
            sim_net_handle_command((const char *)ws_pkt.payload, ws_pkt.len);
        }
        
        free(buf);
    }
    
    return ESP_OK;
}

void sim_net_init(void) {
    sim_wifi_init();

    httpd_config_t config = HTTPD_DEFAULT_CONFIG();
    config.lru_purge_enable = false;
    
    ESP_LOGI(TAG, "Starting HTTP server on port %d...", config.server_port);

    
    if (httpd_start(&server, &config) == ESP_OK) {
        // GET /
        httpd_uri_t index_uri = {
            .uri = "/",
            .method = HTTP_GET,
            .handler = index_get_handler,
            .user_ctx = NULL
        };
        httpd_register_uri_handler(server, &index_uri);

        // GET /favicon.ico
        httpd_uri_t favicon_uri = {
            .uri = "/favicon.ico",
            .method = HTTP_GET,
            .handler = favicon_get_handler,
            .user_ctx = NULL
        };
        httpd_register_uri_handler(server, &favicon_uri);
        
        // WS /ws
        httpd_uri_t ws_uri = {
            .uri = "/ws",
            .method = HTTP_GET,
            .handler = ws_handler,
            .user_ctx = NULL,
            .is_websocket = true
        };
        httpd_register_uri_handler(server, &ws_uri);
        ESP_LOGI(TAG, "Server routes registered successfully");
    } else {
        ESP_LOGE(TAG, "Failed to start server");
    }
}


static void sim_net_ws_send_done(esp_err_t err, int socket, void *arg) {
    if (err != ESP_OK) {
        ESP_LOGW(TAG, "WebSocket telemetry send failed on fd=%d: %s", socket, esp_err_to_name(err));
    }
    free(arg);
}

void sim_net_broadcast(const char *data, size_t len) {
    if (server == NULL) return;
    
    size_t max_clients = 10;
    int client_fds[10];
    if (httpd_get_client_list(server, &max_clients, client_fds) == ESP_OK) {
        for (size_t i = 0; i < max_clients; i++) {
            int fd = client_fds[i];
            if (httpd_ws_get_fd_info(server, fd) == HTTPD_WS_CLIENT_WEBSOCKET) {
                sim_ws_payload_t *payload = malloc(sizeof(sim_ws_payload_t) + len);
                if (payload == NULL) {
                    ESP_LOGW(TAG, "Skipping WebSocket telemetry for fd=%d: out of memory", fd);
                    continue;
                }
                payload->len = len;
                memcpy(payload->data, data, len);

                httpd_ws_frame_t ws_pkt = {
                    .payload = (uint8_t *)payload->data,
                    .len = payload->len,
                    .type = HTTPD_WS_TYPE_TEXT,
                    .final = true
                };
                esp_err_t ret = httpd_ws_send_data_async(server, fd, &ws_pkt, sim_net_ws_send_done, payload);
                if (ret != ESP_OK) {
                    ESP_LOGW(TAG, "Failed to queue WebSocket telemetry for fd=%d: %s", fd, esp_err_to_name(ret));
                    free(payload);
                }
            }
        }
    }
}
