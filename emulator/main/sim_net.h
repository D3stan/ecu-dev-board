#ifndef SIM_NET_H
#define SIM_NET_H

/**
 * @brief Initialize embedded web server and WebSocket server.
 */
void sim_net_init(void);

/**
 * @brief Poll and process incoming network commands.
 */
void sim_net_poll(void);

#endif // SIM_NET_H
