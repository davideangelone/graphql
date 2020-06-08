## GraphQL API
***Introduzione***

Nel precedente articolo abbiamo introdotto la tecnologia GraphQL, mostrandone le principali caratteristiche e confrontandola con il protocollo REST, evidenziando i principali vantaggi e svantaggi di entrambe.

Abbiamo anche mostrato alcuni esempi di chiamate e risposte.

In questo articolo entreremo più nel dettaglio, mostrando l'implementazione di una semplice API GraphQL di un basilare sistema di messaggistica. Sarà possibile postare messaggi ed eseguire query sia per messaggio che per autore. I messaggi e gli autori verranno memorizzati in un simil-database in memoria.

Verrà utilizzato *Node.js*, il framework *Express* ed il package di *npm* [`express-graphql`](https://www.npmjs.com/package/express-graphql).

Si presuppone pertanto che sia già installato sia [`Node.js`](<https://nodejs.org>) che il package manager *npm*.

Tutto il codice di seguito referenziato si trova sul repository <https://github.com/davideangelone/graphql>.


\
***Installazione***

Creiamo una nuova directory, ad esempio `grapql-demo`, quindi al suo interno il file `package.json` :

```json
{
  "name": "graphql-demo",
  "version": "1.0.0",
  "description": "",
  "main": "server.js",
  "dependencies": {
    "express": "^4.17.1",
    "express-graphql": "^0.9.0",
    "graphql": "^15.0.0"
  },
  "devDependencies": {},
  "scripts": {
    "test": "node server.js",
    "start": "node server.js"
  }
}
```

Come possiamo notare, il nostro server utilizza il framework express, il modulo `express-graphql` e la sua dipendenza `graphql`.

Quindi installiamo i package necessari mediante il comando `npm install`.

Poi copiamo anche il file `server.js` e lanciamo il server con `npm run start`.

Sulla console otterremo :

```
Running a GraphQL API server at localhost:4000/graphql
```

A questo punto il nostro server GraphQL è aperto sulla porta 4000.

Di seguito andremo ad analizzare nel dettaglio le componenti più importanti del nostro server (file `server.js`).


***Schema***

Nel seguente frammento viene definito lo schema che il nostro server dovrà utilizzare, utilizzando il linguaggio di GraphQL (la funzione `buildSchema` appartiene al modulo `graphql` importato).

```javascript
var express = require('express');
var graphqlHTTP = require('express-graphql');
var { buildSchema } = require('graphql');

// Construct a schema, using GraphQL schema language
var schema = buildSchema(`
  input MessageInput {
      content: String
      author: AuthorInput!
  }
  
  input AuthorInput {
	name: String!
	age: Int
	nationality: String
  }
    
  type Message {
      id_message: ID!
      content: String
	author: Author!
  }
  
  type Author {
	id_author: ID!
	name: String!
	age: Int
	nationality: String
  }

  type Query {
      getMessage(id_message: ID!): Message
	listMessages(author_name: String!): [Message]
	listAuthors: [Author]
	countMessages: Int
	countAuthors: Int
  }

  type Mutation {
      createMessage(input: MessageInput): Message
      updateMessage(id_message: ID!, content: String): Message
  }

`);
```

Tale linguaggio supporta come predefiniti sia i tipi primitivi (`String`, `Int`, `ID`) che oggetti più complessi (`Query`, `Mutation`) utilizzati per le query e mutazioni. Possiamo anche creare degli oggetti personalizzati per il trasporto dati, in base alle nostre esigenze (`MessageInput`, `AuthorInput`, `Message`, `Author`).

Sono presenti tipi di dato differenti per l'input (`MessageInput`, `AuthorInput`) che per l'output (`Message`, `Author`). I tipi di dato per l'input sono preceduti dal tipo `input`, mentre gli altri dal tipo `type`.

Ogni oggetto ha i suoi campi (il carattere`!` significa che è obbligatorio) , mentre nei tipi `Query` e `Mutation` sono presenti le funzioni che il server metterà a disposizione, coi reletivi parametri di input (`getMessage`, `listMessages`,...).



***Database***

Il server utilizza un simil-database, implementato da mappe dove andremo a memorizzare i messaggi, gli autori e l'associazione autore-messaggio :

```javascript
// Maps of objects
// map id_message -> Message
var messages = {};

//Map name -> Author
var authors = {};

//Map id_author -> id_message
var authorMessages = {};
```



Per popolare queste mappe saranno utilizzati gli oggetti javascript così definiti :

```javascript
// Objects for output
class Message {
  constructor(id_message, {content}, author) {
      this.id_message = id_message;
      this.content = content;
	this.author = author;
  }
}

class Author {
  constructor(id_author, {name, age, nationality}) {
      this.id_author = id_author;
      this.name = name;
      this.age = age;
	this.nationality = nationality;
  }
}
```



***Resolvers***

Di seguito l'implementazione dei vari resolver, uno per ogni funzione esposta :

```javascript
var root = {
  getMessage: ({id_message}) => {
    if (!messages[id_message]) {
      throw new Error('no message exists with id ' + id_message);
    }
    return messages[id_message];
  },
  listMessages: ({author_name}) => {
    if (!authors[author_name]) {
      throw new Error('no authors exists with name ' + author_name);
    }
	
    id_author = authors[author_name].id_author;
    if (!authorMessages[id_author]) {
      throw new Error('no messages exists for author with name ' + author_name);
    }
	
    var messagesFound = [];
    
    authorMessages[id_author].forEach(id_msg => {
	messagesFound.push(messages[id_msg]);
    });

    return messagesFound;
  },
  listAuthors: () => {
    return Object.values(authors);
  },
  countMessages: () => {
    return Object.keys(messages).length;
  },
  countAuthors: () => {
    return Object.keys(authors).length;
  },
  createMessage: ({input}) => {
	
	if (!authors[input.author.name]) {
		// Create random id for author
		var id_author = require('crypto').randomBytes(10).toString('hex');		
		authors[input.author.name] = new Author(id_author, input.author);
	}
	
    // Create random id for message
    var id_message = require('crypto').randomBytes(10).toString('hex');	
    var id_author = authors[input.author.name].id_author;
    message = new Message(id_message, input, authors[input.author.name]);
    messages[id_message] = message;
    
    if (!authorMessages[id_author]) {
	authorMessages[id_author] = [];
    }
    authorMessages[id_author].push(id_message);
	
    return message;
  },
  updateMessage: ({id_message, content}) => {
    if (!messages[id_message]) {
      throw new Error('no message exists with id ' + id_message);
    }
    // This replaces all old data, but some apps might want partial update.
    messages[id_message].content = content;
    return messages[id_message];
  },
};
```



***Inizializzazione GraphQL***

Di seguito l'inizializzazione di Express e della funzione i parsing json (usato per catturare il contenuto le richieste verso il server)

```javascript
var app = express();
app.use(express.json()) // for parsing application/json
```



Vengono poi ridefinite le *estensioni* di GraphQL, nel nostro caso a scopo di logging delle request e response.

```javascript
/* GRAPHQL */
//Estensioni GraphQL
const extensions = ({
  document,
  variables,
  operationName,
  result,
  context,
}) => {
	var name = document.definitions[0].operation + ' (' + document.definitions[0].selectionSet.selections[0].name.value + ')';
	console.log('[' + context.request.ip + '] [' + name + '] request: ', 
		JSON.stringify(context.request.body.query).replace(/\\n/g, '').replace(/\\\"/g, '')
	);
	console.log('[' + context.request.ip + '] [' + name + '] response: ', JSON.stringify(result));
  return {
    runTime: Date.now() - context.startTime,
  };
};
```



Viene utilizzato il middleware di GraphQL e quindi posto in ascolto il server sulla porta 4000 :

```javascript
app.use(
  '/graphql',
  graphqlHTTP(async (request, response, graphQLParams) => {
    return {
      schema: schema,
      context: { startTime: Date.now(), request : request },
	rootValue: root,
	pretty: true,
      graphiql: true,
      extensions
    };
  }),
);

app.listen(4000, () => {
  console.log('Running a GraphQL API server at localhost:4000/graphql');
});
```

Da notare l'impostazione a `true` del parametro `graphiql`.

Questo parametro del modulo express-graphql consente di mettere a disposizione sulla porta del server un IDE (chiamato *GraphiQL*) accessibile da browser, utile per poter testare l'applicazione.

Per accedere a *GraphiQL* andiamo sul browser all'url http://localhost:4000/graphql

![](https://i.imgur.com/EZIVYxP.png)



Sulla parte sinistra dello schermo potremo inserire le nostre *query* e *mutations*, e le risposte verranno visualizzate sulla parte destra.

In alto a destra è presente un pulsante *Docs* che consente di esplorare lo schema GraphQL.

Se sulla parte di sinistra immettiamo la seguente mutation :

```graphql
mutation {
  createMessage(input: {
    content: "This is a test message",
    author: {
      name : "Alice",
    }
  }) {
    id_message
  }
}
```

Otterremo una risposta del genere sulla parte destra :

```json
{
  "data": {
    "createMessage": {
      "id_message": "047435bebff4e14b4b69"
    }
  },
  "extensions": {
    "runTime": 29
  }
}
```



Contemporaneamente sulla console vedremo visualizzate la request e la response:

```
[::1] [mutation (createMessage)] request:  "mutation {  createMessage(input: {    content: This is a test message,    author: {      name : Alice,    }  }) {    id_message  }}"
[::1] [mutation (createMessage)] response:  {"data":{"createMessage":{"id_message":"047435bebff4e14b4b69"}}}
```



E quindi, richiedendo la lista dei messaggi mediante la seguente query

```graphql
query {
  listMessages(author_name : "Alice") {
    id_message
    content
    author {
      id_author
      name
      age
      nationality
    }
  }
}
```

otterremo :

```json
{
  "data": {
    "listMessages": [
      {
        "id_message": "047435bebff4e14b4b69",
        "content": "This is a test message",
        "author": {
          "id_author": "c30b5bca217fb6dafc83",
          "name": "Alice",
          "age": null,
          "nationality": null
        }
      }
    ]
  },
  "extensions": {
    "runTime": 9
  }
}
```

E il corrispondente log sulla console :

```
[::ffff:127.0.0.1] [query (listMessages)] request:  "query {  listMessages(author_name : Alice) {    id_message    content    author {      id_author      name      age      nationality    }  }}"
[::ffff:127.0.0.1] [query (listMessages)] response:  {"data":{"listMessages":[{"id_message":"047435bebff4e14b4b69","content":"This is a test message","author":{"id_author":"c30b5bca217fb6dafc83","name":"Alice","age":null,"nationality":null}}]}}

```



Altri esempi di query e mutations sono presenti nel file `samples.txt`.



**Conclusioni**

In questo articolo abbiamo visto una API GraphQL demo, utilizzando *Node.js* e il server express-graphql per *Express*.

Sono tuttavia presenti molti altri server GraphQL, nei più diversi linguaggi, consultabili su <https://graphql.org/code>.



**Riferimenti**

Di seguito riporto i riferimenti più rilevanti :

<https://github.com/davideangelone/graphql>

<https://www.npmjs.com/package/express-graphql>

<https://graphql.org/code>
