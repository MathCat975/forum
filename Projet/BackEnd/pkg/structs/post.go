package structs

import "time"

type Message struct {
	ID        uint      `db:"id"`
	AuthorId  uint      `db:"author_id"`
	PostId    uint      `db:"post_id"`
	Message   string    `db:"message"`
	CreatedAt time.Time `db:"created_at"`
}

type Post struct {
	ID         uint      `db:"id"`
	AuthorId   uint      `db:"author_id"`
	CategoryId uint      `db:"category_id"`
	Message    string    `db:"message"`
	Title      string    `db:"title"`
	CreatedAt  time.Time `db:"created_at"`
	Comments   []Message `db:"-"`
}

type PostVote struct {
	ID        uint      `db:"id"`
	UserId    uint      `db:"user_id"`
	PostId    uint      `db:"post_id"`
	Value     int       `db:"value"`
	CreatedAt time.Time `db:"created_at"`
}
