#ifndef SIM_NET_H
#define SIM_NET_H

#include <stddef.h>

/**
 * @brief Initialize embedded web server and WebSocket server.
 */
void sim_net_init(void);

/**
 * @brief Poll and process incoming network commands.
 */
void sim_net_poll(void);

/**
 * @brief Broadcast telemetry string to all connected WebSocket clients.
 */
void sim_net_broadcast(const char *data, size_t len);

#endif // SIM_NET_H
