badge
1) si esatto un componente genaral porpse perchè si presta bene ad entrambe e in effetti il comportamneto è lo stesso modificando i dati in input
2) nel caso della pompa si iscrive allo store per il valore outputs.pumpState, mentre per la connection a  socket.state, l'iscrizione avviene al momento della creazione del componente dato che sono componenti che non verranno mai distrutti
3) le callback servono per gestire gli stati del badge ovvero aggiornare la propria label e il proprio style css non devono reagire a nessun evento della dom solo al campio delle proprietà dello store
4) si intendo che può prednere in imput un immagine che nel nostro caso sarà quella della pompa
5) si esatto si inscrive per avere le label corrette

- SensorCard
1) prende in input id per parametro che deve monitorare, poi dato non ci si può iscrivere ad un parametro specifico si registra a config.params e poi controlla che cambi effettivamnete il suo
2) cambia solamente la scritta value e la posizione della barretta verticaleche indica il valore di set point
3) si esatto
4) si esatto l'icona è passata come parametro, mentre il valore del sensore lo prende iscrivendosi a sensors.temperature o sensors.humidity a seconda che sia di unmidità o temperatura e anche questo ovvero il valore al quale iscriversi lo riceve come input
5) il colore non è dimamico deve sempre essere --brand-light è una var css

- TimerForm
1) si iscrive a timers.mode.on e timers.mode.off e aggiorna il valore della label corrispondente ogni volta che variano, in più si iscrive al config.params in particolare al parametro 22 relayMode che se vale byPass allora la fomr deve occupra sapn 6 e non 4
2) i valori on e off si aggiorni come descritto sopra
3) al click si naviga alla pagina TimeSlotEditorPage dei parametri timerOn se clicco solla label del valore o della scritta del dato di on oppure a timerOff qual'ora cliccassi l'altra
4) no non passiamo nessuno dei due in input tanto sono costanti quindi li facciamo hard code nel componente anche per i listener non serve passarli come parametri, il fomato è mm:ss ma si esatto

- FanForm che in realtà sarebbe relayForm perchè rappresenta lo stato del relay 
1) si la mostro o meno a seconda del valore selezioanto per il parametro relayMode se è byPass è nascosta diversamnte è visibile
2) l'icona mostrata dipende dal valore del paramerto relay mode, mentre lo stato on off lo leggo iscrivendomi all valore outputs.extraRelay nello store
3) si il controllo è quello descritto sopra la form NON deve reagire a nessun evento del DOM
 
- SensorsForm
1) si esatto
2) si esattamnete come mostrato in foto
3) si iscrive unicamente alla lingua e aggiorni la scritta sensors con i18n

si il pattern utilizzato è il pattern observer e tutti i componenti ereditano da Components.js
ci sono altri dubbi o puniti poco chiari?