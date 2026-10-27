using UnityEngine;

public enum TileType
{
    Enemy,
    SpikyEnemy,
    FlyingEnemy,
    JumpingEnemy
}

public class Enemy : MonoBehaviour
{
    public TileType Kind;
    public string frame0;
    public string frame1;
    public float dir = 1f;
    public bool Stompable => Kind != TileType.SpikyEnemy;
    static float Speed => 2f;
    readonly RaycastHit2D[] hits = new RaycastHit2D[8];
    float speed;
    private Rigidbody2D rb;

    void Start()
    {
        var go = new GameObject("Enemy");
        rb = go.AddComponent<Rigidbody2D>();
        go.AddComponent<BoxCollider2D>();
        rb.sharedMaterial = new PhysicsMaterial2D("NoFriction") { friction = 0f };
        var filter = new ContactFilter2D { useTriggers = false };
        rb.velocity = new Vector2(-4f, 6f);
        Vector3 back = -transform.right;
        speed = -dir * 2f;
        (frame0, frame1) = Kind switch
        {
            TileType.SpikyEnemy => ("spiky", "spiky_walk"),
            TileType.FlyingEnemy => ("bat1", "bat2"),
            _ => ("enemy", "enemy_walk"),
        };
        GetComponent<Rigidbody2D>().AddForce(Vector2.up * 40f);
        int n = GetComponent<Collider2D>().Cast(Vector2.down, filter, hits, 0.1f);
    }
}
