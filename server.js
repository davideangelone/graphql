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


// Maps of objects
// map id_message -> Message
var messages = {};

//Map name -> Author
var authors = {};

//Map id_author -> id_message
var authorMessages = {};



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

var app = express();
app.use(express.json()) // for parsing application/json


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