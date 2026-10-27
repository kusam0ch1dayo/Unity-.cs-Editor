using UnityEngine;
public class P : MonoBehaviour
{
    [Header("x")] public float speed = 5f;
    public int Score => score;
    private int score;
    void Update()
    {
        var rb = GetComponent<Rigidbody>();
        float v = rb.velocity.magnitude;
        float w = GetComponent<Rigidbody>().velocity.y;
        Debug.Log($"v={v}");
        try { Foo(); } catch (System.Exception e) { Debug.LogError(e); }
        int[] arr = new int[3];
        System.Action a = () => Debug.Log("x");
        for (int i = 10; i > 0; i--) { }
        string s = "a" + 1;
        float z = 2f;
    }
    void Foo() { }
}
