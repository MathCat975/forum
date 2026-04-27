function simpleMarkdown(text) {
  return text
    .replace(/# (.*)/g, '<h1>$1</h1>')
    .replace(/## (.*)/g, '<h2>$1</h2>')
    .replace(/### (.*)/g, '<h3>$1</h3>')
    .replace(/#### (.*)/g, '<h4>$1</h4>')
    .replace(/##### (.*)/g, '<h5>$1</h5>')
    .replace(/###### (.*)/g, '<h6>$1</h6>')
}

const md = "# Hello World\nThis is a **bold** text and this is an *italic* text.\n[Google](https://www.google.com)";

let ligns = md.split('\n').map(line => simpleMarkdown(line.trim())).join('<br>');


///////////////////////////////////////////////////////////////////////////////////////////////////////

// Lasts Posts

let date = new Date().toLocaleDateString();

for (let i = 0; i < 5; i++) {
  let post = document.createElement('div');
  post.classList.add('cardPost');
  post.id = 'post' + (i + 1);
  post.innerHTML = '<h3>Post Title ' + (i + 1) + '</h3>';
  post.innerHTML += '<p class="postDate">Posted on ' + date + '</p>';
  let viewBtn = document.createElement("button");
  viewBtn.innerText = "View";
  viewBtn.classList.add('viewPostButton');
  post.appendChild(viewBtn);
  document.getElementById('postContent').appendChild(post);
}