const fs = require('fs');
const { exec } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('Enter the directory to watch: ', (directory) => {

    console.log(`Watching ${directory} for file changes...`);

    fs.watch(directory, { recursive: true }, (eventType, filename) => {
      if (eventType === 'change') {
        console.log(`File ${filename} has been changed. Performing Git operations...`);

        // Execute Git commands
        exec('git-init && echo Messager-Wiki-Search-Bot | git-push', { cwd: directory }, (gitError) => {
          if (gitError) {
            console.error('Error executing Git push command:', gitError);
          } else {
            console.log('Git push successful.');
          }
        });
      }
    });

    // Close the readline interface when the user presses Ctrl+C
    rl.on('SIGINT', () => {
      console.log('\nStopping file watcher...');
      rl.close();
    });
})
