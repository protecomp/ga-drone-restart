const core = require('@actions/core');
const fetch = require('node-fetch');

async function github_query(github_token, query, variables) {
  return fetch('https://api.github.com/graphql', {
    method: 'POST',
    body: JSON.stringify({query, variables}),
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `bearer ${github_token}`,
    }
  }).then(function(response) {
    return response.json();
  });
}

// most @actions toolkit packages have async methods
async function run() {
  try { 
    const github_token = core.getInput('github_token');
    const repository = core.getInput('repository');
    const drone_url = core.getInput('drone_url');
    const drone_token = core.getInput('drone_token');

    const drone_base = drone_url + '/api/repos/'

    let query = `
    query($owner:String!, $name:String!) { 
      repository(owner: $owner, name: $name) {
        pullRequests(states:OPEN, first:100) {
          nodes {
            commits(first:1) {
              nodes {
                commit {
                  status {
                    contexts {
                      targetUrl
                    }
                  }
                }
              }
            }
          }
        }
      }
    }`;
    let variables = { owner: repository.split("/")[0], name: repository.split("/")[1] };

    let response = await github_query(github_token, query, variables);
    console.log(response);

    let targetUrls = [];
    for (const node of response['data']['repository']['pullRequests']['nodes']) {
      const commit = node['commits']['nodes'][0]['commit'];
      if (commit['status'] !== null && commit['status']['contexts'] != undefined) {
        for (const context of commit['status']['contexts']) {
          console.log(context['targetUrl']);
          const values = context['targetUrl'].split('/')
          targetUrls.push(drone_base + values.slice(-3)[0] + '/' + values.slice(-2)[0] + '/builds/' + values.slice(-1)[0])
        }
      }
    }
    console.log(targetUrls);

    for (const targetUrl of targetUrls) {
      fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `bearer ${drone_token}`,
        }
      }).then(function(response) {
        console.log(response)
      });
    }
  } 
  catch (error) {
    core.setFailed(error.message);
  }
}

run()
