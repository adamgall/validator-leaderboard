import http from 'http';
import https from 'https';

const httphttps = {
  request: (
    options: http.RequestOptions,
    callback?: ((res: http.IncomingMessage) => void) | undefined): http.ClientRequest => {
    if (options.protocol === "https:") {
      return https.request(options, callback);
    } else {
      return http.request(options, callback)
    }
  }
}

export const getFromAPI = async <T>(path: string, dataMapper: (jsonData: any) => T | null): Promise<[T | null, number | undefined]> => {
  const options = {
    protocol: process.env.CL_PROTOCOL,
    hostname: process.env.CL_HOSTNAME,
    port: process.env.CL_PORT,
    path: path,
    method: 'GET',
    headers: {
      'accept': 'application/json',
    },
    agent: false,
  };

  return new Promise<[T | null, number | undefined]>((resolve, reject) => {
    const request = httphttps.request(options, response => {
      response.setEncoding('utf8');

      if (response.statusCode) {
        if (response.statusCode === 404) {
          console.warn(`${response.statusCode} ${response.statusMessage}`);
          return resolve([<T>null, response.statusCode])
        } else if (response.statusCode < 200 || response.statusCode > 299) {
          console.error(`${response.statusCode} ${response.statusMessage}`)
          return reject(new Error(`${response.statusCode} ${response.statusMessage}`));
        }
      }

      let data = '';

      response.on('data', (chunk) => {
        data += chunk;
      });

      response.on('end', () => {
        const jsonData = JSON.parse(data);
        const object = dataMapper(jsonData);
        resolve([object, response.statusCode]);
      });
    });

    request.on('error', (error) => {
      console.error(error);
      reject(error);
    });

    request.end();
  });
}
