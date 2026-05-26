package structs

import "time"

type Message struct {
	ID        uint      `db:"id" json:"id"`
	AuthorId  uint      `db:"author_id" json:"author_id"`
	PostId    uint      `db:"post_id" json:"post_id"`
	Message   string    `db:"message" json:"message"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
}

type Post struct {
	ID         uint      `db:"id" json:"id"`
	AuthorId   uint      `db:"author_id" json:"author_id"`
	CategoryId uint      `db:"category_id" json:"category_id"`
	Message    string    `db:"message" json:"message"`
	Title      string    `db:"title" json:"title"`
	CreatedAt  time.Time `db:"created_at" json:"created_at"`
	Comments   []Message `db:"-" json:"comments,omitempty"`
}

type PostVote struct {
	ID        uint      `db:"id" json:"id"`
	UserId    uint      `db:"user_id" json:"user_id"`
	PostId    uint      `db:"post_id" json:"post_id"`
	Value     int       `db:"value" json:"value"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
}
